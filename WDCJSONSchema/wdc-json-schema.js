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

  // Helper function needed because underscore's map and forEach methods use duck-typing
  // to treat objects with a "length" property like an array
  function mapObject(obj, iteratee, ctx) { return _.chain(obj).mapObject(iteratee, ctx).values().value(); }

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
  join.multiple = function() { return join.apply(null, _.flatten(arguments, 1)); };

  function convertToTableHeaders(schema) {
    function joinHeaderKey(prefix, key) { return ((prefix ? (prefix + '.') : '') + key); }

    // Internal recursive function
    function _convertToTableHeaders(prefix, schema) {
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

    return _convertToTableHeaders('', schema);
  }

  function convertToTable(data, schema) {

    function parseObjectForTable(obj, fieldList) {
      if(fieldList.length === 0) return newEmptyTable(); // Return an empty table if no field list is given

      var tables = fieldList.map(function(field) {
        return parseField(obj, field);
      });
      return join.multiple(tables);
    }

    function addObjectFieldNameToRow(fieldName, row) {
      var newRow = {};
      mapObject(row, function(val, key) {
        newRow[buildObjectKey(fieldName, key)] = val;
      });
      return newRow;
    }

    function parseObjectForTableFromField(fieldName, obj, fieldList) {
      var objTable = parseObjectForTable(obj, fieldList);

      return objTable.map(function(row) {
        return addObjectFieldNameToRow(fieldName, row);
      });
    }

    function parseField(rowInput, field) {
      var table = [];
      var value = (_(rowInput).isNull() || _(rowInput).isUndefined()) ? null : rowInput[field.name];
      if(_(value).isUndefined()) value = null;

      if(field.type === FIELD_TYPE.object) {

        table = parseObjectForTableFromField(field.name, value, field.subFields);

      } else if(field.type === FIELD_TYPE.array) {

        var columnKey = buildArrayKey(field.name);
        var fieldValuesList = (_(value).isArray() && value.length > 0) ? value : [ null ];
        // TODO: Should fieldValuesList be flattened? I doubt it.

        if(field.arrayType === FIELD_TYPE.object) {

          table = _.flatten(fieldValuesList.map(function(fieldObj) {
            return parseObjectForTableFromField(columnKey, fieldObj, field.subFields);
          }));

        } else {

          table = fieldValuesList.map(function(fieldValue) {
            return _.object([[ columnKey, fieldValue ]]);
          });

        }

      } else {

        if(_(value).isObject() || _(value).isFunction()) value = null;

        table.push( _.object([[ field.name, value ]]) );

      }

      return table;
    }

    return _.flatten([].concat(data).map(function(rowInput) {
      return parseObjectForTable(rowInput, schema);
    }));
  }

  // TODO: Finish this
  var SAMPLE_SIZE = 10;
  function generateSchema(data, sampleSize) {
    sampleSize = sampleSize || SAMPLE_SIZE;

    function estimateType(val) {
      switch(typeof val) {
        case 'string':
          if(_(Date.parse(val)).isNaN()) return FIELD_TYPE.string;
          return (val.indexOf(':') >= 0) ? FIELD_TYPE.datetime : FIELD_TYPE.date;
        case 'object':
          return _(val).isArray() ? FIELD_TYPE.array : FIELD_TYPE.object;
        case 'boolean':
          return FIELD_TYPE.bool;
        case 'number':
          return (val.toString().indexOf('.') >= 0) ? FIELD_TYPE.float : FIELD_TYPE.int;
      }
    }

    function bestTypeEstimate(types) {
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

    function buildField(val, key) {
      var type = estimateType(val);
      if(!type) return null; // if a type couldn't be determined, don't create a field, let the user add it

      var field = { name: key, type: type };

      if(type === FIELD_TYPE.array) {
        var sampleArray = _.sample(val, sampleSize);
        var types = sampleArray.map(estimateType);
        field.arrayType = bestTypeEstimate(types);

        if(!field.arrayType) return null;

        if(field.arrayType === FIELD_TYPE.object) {
          field.subFields = generateSchema(sampleArray, sampleSize);
        }
      } else if(type === FIELD_TYPE.object) {
        field.subFields = mapObject(val, buildField);
      }

      return field;
    }

    function bestSchemaEstimate(schemas) {
      var fieldMap = _.groupBy(_.flatten(schemas), function(field) { return field.name; });
      return _.compact(mapObject(fieldMap, function(fields, name) {
        var estimatedType = bestTypeEstimate(fields.map(function(field) { return field.type; }));
        var isArrayType = (estimatedType === FIELD_TYPE.array);

        var field = { name: name };

        if(isArrayType) {
          estimatedType = bestTypeEstimate(fields.map(function(field) { return field.arrayType; }));

          field.type = FIELD_TYPE.array;
          field.arrayType = estimatedType;
        } else {
          field.type = estimatedType;
        }

        if(!estimatedType) return null; // If there is no estimated type then we can't create a field

        if(estimatedType === FIELD_TYPE.object) {
          // TODO: Validate subField schemas against each other...

          field.subFields = bestSchemaEstimate(fields.map(function(field) { return field.subFields }));
          if(field.subFields.length === 0) return null;
        }

        return field;
      }));
    }

    var fieldSchemas = _.sample([].concat(data), sampleSize).map(function(obj){
      return _.compact(mapObject(obj, buildField));
    });

    return bestSchemaEstimate(fieldSchemas);
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