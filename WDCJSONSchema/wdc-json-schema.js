(function(window, _) {

  var FIELD_TYPE = {
    string: 'string',
    bool: 'bool',
    int: 'int',
    float: 'float',
    date: 'date',
    datetime: 'datetime',
    array: 'array',
    object: 'object'
  };

  // helper functions
  function buildObjectKey(fieldName, childKey) { return (fieldName + '.' + childKey); }
  function buildArrayKey(key) { return (key + '[]'); }
  function newEmptyTable() { return [{}]; }
  function isUndefined(x) { return x === void 0; }
  function isObjectOrFunction(x) {
    var type = typeof x;
    return type === 'object' || type === 'function'
  }

  // Helper function needed because underscore's map and forEach methods use duck-typing
  // to treat objects with a "length" property like an array
  function mapObject(obj, iteratee, ctx) { return _.chain(obj).mapObject(iteratee, ctx).values().value(); }

  // Joins tables.  A table is an array of flat objects that contain all of the same object keys
  // @param tables... - Pass in any number of tables
  // @return Array - returns an array of flat objects all containing the same keys
  function join() {
    var tables = _.toArray(arguments);
    var joinedTable = newEmptyTable();

    tables.forEach(function(table) {
      var newJoinedTable = [];
      [].concat(joinedTable).forEach(function(row1) {
        [].concat(table).forEach(function(row2) {
          newJoinedTable.push(_.extend({}, row1, row2));
        });
      });
      joinedTable = newJoinedTable;
    });

    return joinedTable;
  }

  // @param tableArrays... - pass in any number of arrays of tables
  // @return Array - returns an array of flat objects all containing the same keys
  join.multiple = function() { return join.apply(null, _.flatten(arguments, 1)); };

  // @param schema - a JSON schema
  // @return object - returns an object that maps Tableau field name to field type
  function convertToTableHeaders(schema) {
    var headers = {};

    schema.forEach(function(field) {
      var type = field.type;
      var name = field.name;

      if(type === FIELD_TYPE.array) {
        type = field.arrayType;
        name = buildArrayKey(name);
      }

      if(type === FIELD_TYPE.object && field.subFields) {

        var childHeaders = convertToTableHeaders(field.subFields);
        mapObject(childHeaders, function(type, childKey) {
          headers[buildObjectKey(name, childKey)] = type;
        });

      } else {
        headers[name] = type;
      }
    });

    return headers;
  }

  var convertToTableHelper = {
    joinMultiple: join.multiple,
    addObjectFieldNameToRow: function(fieldName, row) {
      var newRow = {};
      mapObject(row, function(val, key) {
        newRow[buildObjectKey(fieldName, key)] = val;
      });
      return newRow;
    },
    parseObjectForTableFromField: function(fieldName, obj, fieldList) {
      var objTable = convertToTableHelper.parseObjectForTable(obj, fieldList);

      return objTable.map(function(row) {
        return convertToTableHelper.addObjectFieldNameToRow(fieldName, row);
      });
    },
    parseField: function(rowInput, field) {
      var table = [];
      var value = (rowInput == null) ? null : rowInput[field.name];
      if(isUndefined(value)) value = null;

      if(field.type === FIELD_TYPE.object) {

        table = convertToTableHelper.parseObjectForTableFromField(field.name, value, field.subFields);

      } else if(field.type === FIELD_TYPE.array) {

        var columnKey = buildArrayKey(field.name);
        var fieldValuesList = (Array.isArray(value) && value.length > 0) ? value : [ null ];
        // TODO: Should fieldValuesList be flattened? I doubt it.

        if(field.arrayType === FIELD_TYPE.object) {

          table = _.flatten(fieldValuesList.map(function(fieldObj) {
            return convertToTableHelper.parseObjectForTableFromField(columnKey, fieldObj, field.subFields);
          }));

        } else {

          table = fieldValuesList.map(function(fieldValue) {
            return _.object([[ columnKey, fieldValue ]]);
          });

        }

      } else {

        if(isObjectOrFunction(value)) value = null;

        table.push( _.object([[ field.name, value ]]) );

      }

      return table;
    },
    parseObjectForTable: function(obj, fieldList) {
      if(fieldList.length === 0) return newEmptyTable(); // Return an empty table if no field list is given

      var tables = fieldList.map(function(field) {
        return convertToTableHelper.parseField(obj, field);
      });
      return convertToTableHelper.joinMultiple(tables);
    }
  }

  // Given the data and a schema, this method generates a table that can be passed into the Tableau WDC
  // @param data - a JSON object of data
  // @param schema - a JSON schema
  // @return object - returns a table
  function convertToTable(data, schema) {
    return _.flatten([].concat(data).map(function(rowInput) {
      return convertToTableHelper.parseObjectForTable(rowInput, schema);
    }));
  }


  function SchemaGenerator(sampleSize) {
    this.sampleSize = sampleSize || SchemaGenerator.SAMPLE_SIZE;
  }

  // Static variables/methods
  _.extend(SchemaGenerator, {
    SAMPLE_SIZE: 10,
    estimateType: function(val) {
      switch(typeof val) {
        case 'string':
          if(isNaN(Date.parse(val))) return FIELD_TYPE.string;
          return (val.indexOf(':') >= 0) ? FIELD_TYPE.datetime : FIELD_TYPE.date;
        case 'object':
          return Array.isArray(val) ? FIELD_TYPE.array : FIELD_TYPE.object;
        case 'boolean':
          return FIELD_TYPE.bool;
        case 'number':
          return (val.toString().indexOf('.') >= 0) ? FIELD_TYPE.float : FIELD_TYPE.int;
      }
    },
    bestTypeEstimate: function(types) {
      var uniqTypes = _.uniq(types);
      switch(uniqTypes.length) {
        case 0: return; // If there no types then leave it empty for the user to fill in
        case 1:
          var type = uniqTypes[0]; // all types are the same so return the first one
          return type;
        default:
          // check if floats and ints are getting confused then choose floats
          if(_.difference(uniqTypes, [FIELD_TYPE.int, FIELD_TYPE.float]).length === 0) {
            return FIELD_TYPE.float;
          }

          // check if date, datetime, and strings are getting confused, string > datetime > date
          var typeDiff = _.difference(uniqTypes, [FIELD_TYPE.date, FIELD_TYPE.datetime]);
          if(typeDiff.length === 0) return FIELD_TYPE.datetime; //If we can't tell, generalize to datetime
          if(typeDiff.length === 1 && typeDiff[0] === FIELD_TYPE.string) {
            return FIELD_TYPE.string; //If we can't tell, generalize to string
          }
          break;
      }
    }
  });

  // instance methods
  _.extend(SchemaGenerator.prototype, {
    generateSchemaFromData: function(dataArray) {
      var _this = this;
      var fieldSchemas = _.sample(dataArray, this.sampleSize).map(function(obj){
        return _.compact(mapObject(obj, _this.buildField, _this));
      });

      return this.bestSchemaEstimate(fieldSchemas);
    },
    buildField: function(val, key) {
      var type = SchemaGenerator.estimateType(val);
      if(!type) return null; // if a type couldn't be determined, don't create a field, let the user add it

      var field = { name: key, type: type };

      if(type === FIELD_TYPE.array) {
        var sampleArray = _.sample(val, this.sampleSize);
        var types = sampleArray.map(SchemaGenerator.estimateType);
        field.arrayType = SchemaGenerator.bestTypeEstimate(types);

        if(!field.arrayType) return null;

        if(field.arrayType === FIELD_TYPE.object) {
          field.subFields = this.generateSchemaFromData(sampleArray);
        }
      } else if(type === FIELD_TYPE.object) {
        field.subFields = mapObject(val, this.buildField, this);
      }

      return field;
    },
    bestSchemaEstimate: function(schemas) {
      var _this = this;
      var fieldMap = _.groupBy(_.flatten(schemas), function(field) { return field.name; });
      return _.compact(mapObject(fieldMap, function(fields, name) {
        var fieldTypes = fields.map(function(field) { return field.type; });
        var estimatedType = SchemaGenerator.bestTypeEstimate(fieldTypes);
        var isArrayType = (estimatedType === FIELD_TYPE.array);

        var field = { name: name };

        if(isArrayType) {
          var arrayTypes = fields.map(function(field) { return field.arrayType; });
          estimatedType = SchemaGenerator.bestTypeEstimate(arrayTypes);

          field.type = FIELD_TYPE.array;
          field.arrayType = estimatedType;
        } else {
          field.type = estimatedType;
        }

        if(!estimatedType) return null; // If there is no estimated type then we can't create a field

        if(estimatedType === FIELD_TYPE.object) {

          var subFeildSchemas = fields.map(function(field) { return field.subFields });
          field.subFields = _this.bestSchemaEstimate(subFeildSchemas);
          if(field.subFields.length === 0) return null;

        }

        return field;
      }));
    }
  });

  // @param data[object] - array of objects of data to parse to generate the schema
  // @param sampleSize[number](default=10) - max number of items to check in the data and nested arrays
  function generateSchema(data, sampleSize) {
    var schemaGenerator = new SchemaGenerator(sampleSize);
    var arrayData = [].concat(data);
    return schemaGenerator.generateSchemaFromData(arrayData);
  }

  function validateSchema(schema) {
    //TODO: Verify that all fields have a non-empty name? OR create a field with an empty name when creating a field
    //TODO: Verify that no values have the same name.
  }

  window.WDCSchema= {
    join: join,
    convertToTableHeaders: convertToTableHeaders,
    convertToTable: convertToTable,
    generateSchema: generateSchema,
    FIELD_TYPE: _.clone(FIELD_TYPE)
  };
})(window, _);