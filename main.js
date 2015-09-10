/*
TODO:
X allow a way to set type for array to any other type
X create method that takes input JSON and schema to a flat table
X create method that takes schema and generates the header
- hook up to an API

BONUS:
- pass in a JSON to generate the initial schema
- create a way to join multiple requests to create the table
 */

(function(ns, $, _, React) {

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

  var DOM = React.DOM;

  var FieldTypeSelect = React.createClass({
    render: function() {
      var fields = _(FieldTypeSelect.TYPE_LIST).difference(this.props.without);

      return (
        DOM.select({ className: this.props.className, value: this.props.value, onChange: this.props.onChange },
          fields.map(function(fieldType) {
            return DOM.option({ key: fieldType, value: fieldType }, fieldType);
          })
        )
      );
    }
  });
  FieldTypeSelect.factory = React.createFactory(FieldTypeSelect);
  FieldTypeSelect.TYPE_LIST = [
    FIELD_TYPE.string,
    FIELD_TYPE.bool,
    FIELD_TYPE.int,
    FIELD_TYPE.float,
    FIELD_TYPE.date,
    FIELD_TYPE.datetime,
    FIELD_TYPE.array,
    FIELD_TYPE.object
  ];

  var Field = React.createClass({
    getInitialState: function() {
      var field = {
        key: this.props.field.key,
        name: this.props.field.name,
        type: this.props.field.type,
        arrayType: this.props.field.arrayType
      };
      if(Field.hasSubFields(field)) {
        field.subFields = this.props.subFields || [];
      }
      return { field : field };
    },
    render: function() {
      var fieldGroup = null;
      if(this.hasSubFields()) {
        fieldGroup = FieldGroup.factory({ className: 'subFields', onFieldUpdate: this.onSubFieldGroupUpdate });
      }

      var arrayType = null;
      if(this.hasArrayType()) {
        arrayType = (
          DOM.div({ className: 'fieldArrayType' },
            DOM.span(null, 'Array Type: '),
            FieldTypeSelect.factory(
              {
                value: this.state.field.arrayType,
                without: [Field.TYPE.array],
                onChange: this.onArrayFieldTypeChange
              }
            )
          )
        );
      }

      return (
        DOM.div({ className: 'field' },
          //DOM.span({ className: 'description' }, 'field:'),
          DOM.input({ type: 'text', className: 'fieldName', value: this.state.field.name, onChange: this.onFieldNameChange }),
          FieldTypeSelect.factory({ className: 'fieldType', value: this.state.field.type, onChange: this.onFieldTypeChange }),
          DOM.span({ className: 'fieldDelete', onClick: this.props.onFieldDelete }, 'Delete'),
          arrayType,
          fieldGroup
        )
      );
    },
    // special functions
    hasArrayType: function() {
      return Field.hasArrayType(this.state.field);
    },
    hasSubFields: function() {
      return Field.hasSubFields(this.state.field);
    },
    setupSubFields: function() {
      if(this.hasSubFields()) {
        this.state.field.subFields = [];
      } else {
        delete this.state.field.subFields;
      }
    },
    notifyUpdate: function() {
      this.setState(this.state, function() {
        this.props.onFieldUpdate(this.state.field);
      });
    },
    onSubFieldGroupUpdate: function(fieldGroupUpdate) {
      this.state.field.subFields = fieldGroupUpdate;
      this.notifyUpdate();
    },
    onFieldNameChange: function(event) {
      this.state.field.name = event.target.value;
      this.notifyUpdate();
    },
    onFieldTypeChange: function(event) {
      this.state.field.type = event.target.value;
      if(this.hasArrayType()) {
        this.state.field.arrayType = Field.DEFAULT_TYPE;
      }
      this.setupSubFields();
      this.notifyUpdate();
    },
    onArrayFieldTypeChange: function(event) {
      this.state.field.arrayType = event.target.value;
      this.setupSubFields();
      this.notifyUpdate();
    }
  });
  Field.factory = React.createFactory(Field);
  Field.hasArrayType = function(field) {
    return (field.type === Field.TYPE.array);
  };
  Field.hasSubFields = function(field) {
    return (Field.hasArrayType(field) && field.arrayType === Field.TYPE.object)
        || (field.type === Field.TYPE.object);
  };
  Field.TYPE = FIELD_TYPE;
  Field.TYPE_LIST = FIELD_TYPE;
  Field.DEFAULT_TYPE = Field.TYPE.string;

  ////////////////////////////////////////////////////////////////

  var fieldGroupFieldKey = 0; // static variable used to create a unique key for each field created
  var FieldGroup = React.createClass({
    getInitialState: function() {
      return {fields: []};
    },
    render: function() {
      var _this = this;
      return (
        DOM.div({ className: this.props.className },
          this.state.fields.map(function(field) {
            return Field.factory({ field: field, key: field.key, onFieldUpdate: _this.onFieldUpdateFactory(field),
                                   onFieldDelete: _this.removeField(field) });
          }),
          DOM.div({ className: 'addField', onClick: this.addField }, '+ Add a new field')
        )
      );
    },
    /////////////////////////////////////////////
    setFields: function(fields) {
      this.setState({fields: fields}, function() {
        this.props.onFieldUpdate(this.state.fields);
      });
    },
    addField: function(event) {
      var fields = this.state.fields.concat({ key: fieldGroupFieldKey++, name: '', type: Field.DEFAULT_TYPE });
      this.setState({ fields: fields });
    },
    removeField: function(field) {
      var _this = this;
      return function() {
        var fields = $.extend([], _this.state.fields);
        fields.splice(fields.indexOf(field), 1); // Remove the field

        _this.setFields(fields);
      }
    },
    onFieldUpdateFactory: function(field) {
      var _this = this;
      return function(fieldUpdate) {
        field.key = fieldUpdate.key;
        field.name = fieldUpdate.name;
        field.type = fieldUpdate.type;
        if(fieldUpdate.arrayType) field.arrayType = fieldUpdate.arrayType;
        if(fieldUpdate.subFields) field.subFields = fieldUpdate.subFields;

        _this.setFields(_this.state.fields);
      };
    }
  });
  FieldGroup.factory = React.createFactory(FieldGroup);

  ////////////////////////////////////////////////////////////////

  var TablePreview = React.createClass({
    getInitialState: function () {
      return { previewText: '', errorMessage: '' };
    },
    componentDidMount: function() {
      this.setState(this.propsToState(this.props));
    },
    render: function () {
      return (
        this.state.errorMessage
        ? DOM.div({ className: 'previewError' }, this.state.errorMessage)
        : DOM.pre({ className: 'previewDisplay'}, this.state.previewText)
      );
    },
    componentWillReceiveProps: function(nextProps) {
      this.setState(this.propsToState(nextProps));
    },
    ////////////////////////////////////////////
    propsToState: function(props) {
      var previewText = '';
      var errorMessage = '';
      try {
        var previewTable = convertToTable(JSON.parse(props.dataString), props.schema);
        previewText = JSON.stringify(previewTable, null, 2);
      } catch(e) {
        if(e instanceof SyntaxError) {
          errorMessage = 'Invalid preview input data';
        } else {
          console.error(e);
          errorMessage = e.message;
        }
      }
      return { previewText: previewText, errorMessage: errorMessage };
    }
  });
  TablePreview.factory = React.createFactory(TablePreview);

  var SchemaPreviewApp = React.createClass({
    getInitialState: function () {
      return { schema: [], dataString: '[]' };
    },
    render: function () {
      return (
        DOM.div({ style: { height: '100%', width: '100%' } },
          DOM.div({ className: 'previewColumn' },
            FieldGroup.factory({ onFieldUpdate: this.updateSchema, value: this.state.schema })
          ),
          DOM.div({ className: 'previewColumn' },
            DOM.textarea({ style: { height: '300px', width: '98%' }, onChange: this.updateDataString }, this.state.dataString )
          ),
          DOM.div({ className: 'previewColumn' },
            TablePreview.factory(this.state)
            //DOM.pre(null, this.state.dataString)
          )
        )
      );
    },
    /////////////////////////////////////////////////
    updateSchema: function(schema) {
      this.setState({ schema: schema });
      ns.fieldGroup = schema;
    },
    updateDataString: function(event) {
      this.setState({ dataString: event.target.value });
    }
  });

  /*
  [
    {
      "foo":"0",
      "bar":"1"
    },
    {
      "foo":"2",
      "bar":"3"
    },
    {
      "foo":"4",
      "bar":"5"
    },
    {
      "foo":"6",
      "bar":"7"
    }
  ]
  */

  ///////////////////////////////////////////////
  // Table helpers
  ///////////////////////////////////////////////

  function join() {
    var tables = _.toArray(arguments);
    var joinedTable = [];

    // Get the first set of rows to have rows to join against
    while(joinedTable.length === 0 && tables.length > 0) {
      joinedTable = joinedTable.concat(tables.shift());
    }

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
  join.multiple = function(tables) { return join.apply(null, tables); };

  function convertToTableHeaders(schema) {
    function joinHeaderKey(prefix, key) { return ((prefix ? (prefix + '.') : '') + key); }
    function arrayHeader(prefix) { return (prefix + '[]'); }

    // Internal recursive function
    function _convertToTableHeaders(prefix, schema) {
      var headers = {};

      schema.forEach(function(field) {
        var type = field.type;
        var name = field.name;

        if(type === FIELD_TYPE.array) {
          type = field.arrayType;
          name = arrayHeader(name);
        }

        if(type === FIELD_TYPE.object) {
          var subFieldHeaders = _convertToTableHeaders(name, field.subFields);
          _.forEach(subFieldHeaders, function(type, key) {
            headers[joinHeaderKey(prefix, key)] = type;
          });
        } else {
          headers[joinHeaderKey(prefix, name)] = type;
        }
      });

      return headers;
    }

    return _convertToTableHeaders('', schema);
  }

  ns.getHeaders = function() {
    return convertToTableHeaders(ns.fieldGroup);
  };

  function buildObjectKey(fieldName, childKey) { return (fieldName + '.' + childKey); }
  function buildArrayKey(key) { return (key + '[]'); }


  function convertToTable(data, schema) {

    function parseObjectForTable(obj, fieldList) {
      if(fieldList.length === 0) return [{}]; // Return an empty table if no field list is given

      var tables = fieldList.map(function(field) {
        return parseField(obj, field);
      });
      return join.multiple(tables);
    }

    function addObjectFieldNameToRow(fieldName, row) {
      var newRow = {};
      _(row).forEach(function(val, key) {
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
  var DEFAULT_TYPE = FIELD_TYPE.object;
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
          if(type === FIELD_TYPE.array) return; // don't allow array types
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
        field.subFields = _.map(val, buildField);
      }

      return field;
    }

    var schemas = _.sample([].concat(data), sampleSize).map(function(obj){
      return _.compact(_.map(obj, buildField));
    });

    var estimatedSchema;

    var fieldMap = _.groupBy(_.flatten(schemas), 'name');
    _.compact(_.map(fieldMap), function(fields, name) {
      var estimatedType = bestTypeEstimate(_.pluck(fields, 'type'));
    });


    return estimatedSchema;
  }



  function validateSchema(schema) {
    //TODO: Verify that all fields have a non-empty name? OR create a field with an empty name when creating a field
    //TODO: Verify that no values have the same name.
  }

  ///////////////////////////////////////////////
  /// Tests
  ///////////////////////////////////////////////

  var t1 = [{ a1: 0, a2: 1, a3: 2 }];
  var t2 = [
    { b1: 0, b2: 1, b3: 2 },
    { b1: 3, b2: 4, b3: 5 }
  ];

  var result = [
    { a1: 0, a2: 1, a3: 2, b1: 0, b2: 1, b3: 2 },
    { a1: 0, a2: 1, a3: 2, b1: 3, b2: 4, b3: 5 }
  ];

  if(_.isEqual(join(t1, t2), result)) {
    console.log('+ join() method is working properly')
  } else {
    console.error('- join() method is broken :(')
  }

  var schema = [
    { name: 'stringKey', type: 'string' },
    { name: 'stringArrayKey', type: 'array', arrayType: 'string' },
    {
      name: 'objectArrayKey', type: 'array', arrayType: 'object',
      subFields: [
        { name: 'intKey', type: 'int' },
        { name: 'floatKey', type: 'float' }
      ]
    },
    {
      name: 'objectKey', type: 'object',
      subFields: [
        {name: 'boolKey', type: 'bool'}
      ]
    }
  ];

  var expectedHeaders = {
    'stringKey': 'string',
    'stringArrayKey[]': 'string',
    'objectArrayKey[].intKey': 'int',
    'objectArrayKey[].floatKey': 'float',
    'objectKey.boolKey': 'bool'
  };

  if(_.isEqual(convertToTableHeaders(schema), expectedHeaders)) {
    console.log('+ convertToTableHeaders() method is working properly')
  } else {
    console.error('- convertToTableHeaders() method is broken :(')
  }

  var json = [
    //$mark-jeziTheCat: aassssssssssssss5444444444444sssss
    {
      'stringKey': '0',
      'stringArrayKey': ['1', '2'],
      'objectArrayKey': [
        {
          'intKey': 3,
          'floatKey': 4.5
        }
      ],
      objectKey: {
        boolKey: true
      }
    },
    {
      'stringKey': '10',
      'stringArrayKey': ['11'],
      'objectArrayKey': [
        {
          'intKey': 13,
          'floatKey': 14.15
        },
        {
          'intKey': 16,
          'floatKey': 17.18
        }
      ],
      objectKey: {
        boolKey: false
      }
    }
  ];

  var expectedTable = [
    {
      'stringKey': '0',
      'stringArrayKey[]': '1',
      'objectArrayKey[].intKey': 3,
      'objectArrayKey[].floatKey': 4.5,
      'objectKey.boolKey': true
    },
    {
      'stringKey': '0',
      'stringArrayKey[]': '2',
      'objectArrayKey[].intKey': 3,
      'objectArrayKey[].floatKey': 4.5,
      'objectKey.boolKey': true
    },
    {
      'stringKey': '10',
      'stringArrayKey[]': '11',
      'objectArrayKey[].intKey': 13,
      'objectArrayKey[].floatKey': 14.15,
      'objectKey.boolKey': false
    },
    {
      'stringKey': '10',
      'stringArrayKey[]': '11',
      'objectArrayKey[].intKey': 16,
      'objectArrayKey[].floatKey': 17.18,
      'objectKey.boolKey': false
    }
  ];

  var resultTable = convertToTable(json, schema);
  if(_.isEqual(resultTable, expectedTable)) {
    console.log('+ convertToTable() method is working properly');
  } else {
    console.error('- convertToTable() method is broken :(');
    console.log(resultTable);
    console.log(expectedTable);
  }

  // Validate data with missing keys and a schema with empty objects
  json = [{}, {}];
  schema = [
    { name: 'stringKey', type: 'string' },
    { name: 'objectKey', type: 'object', subFields: [ ] },
    { name: 'arrayKey', type: 'array', arrayType: 'object', subFields: [ ] }
  ];
  expectedTable = [
    { stringKey: null },
    { stringKey: null }
  ];

  resultTable = convertToTable(json, schema);
  if(_.isEqual(resultTable, expectedTable)) {
    console.log('+ convertToTable() method is working properly for data with missing keys and a schema with empty objects');
  } else {
    console.error('- convertToTable() method is broken for data with missing keys and a schema with empty objects');
    console.log(resultTable);
    console.log(expectedTable);
  }

  ///////////////////////////////////////////////

  function updateGlobalFieldGroup(fieldGroup) {
    ns.fieldGroup = fieldGroup;
  }

  $(function() {
    //ns.fieldGroup = new FieldGroupElm($('body'));
    React.render(
      React.createElement(SchemaPreviewApp),
      document.getElementById('fieldGroup')
    );
  });


  /*
  var x = [
    {
      foo: "bar",
      baz: 5,
      qux: {
        blah: "Sat Sep 05 2015 23:48:56 GMT-0700",
        shannon: 'hi'
      }
    }
  ]

  var headers = {
    foo: "string",
    baz: "int",
    "qux.blah": "datetime",
    "qux.shannon": "string",
  };

  var data = [
    {
      foo: "bar",
      baz: 5,
      "qux.blah": "Sat Sep 05 2015 23:48:56 GMT-0700",
      "qux.shannon": "hi",
    }
  ]
  */

  /*
  function FieldElm($parent) {
    this.$parent = $parent;

    var select = $('<select class="fieldType">');
    FIELD_TYPES.forEach(function(fieldType) {
      select.append($('<option>').attr({ value: fieldType }).text(fieldType));
    });

    this.$elm = $('<div>').addClass('field')
      .append($('<span>').addClass('description').text('field: '))
      .append($('<input>').attr({ type: 'text' }).addClass('fieldName'))
      .append(select)
      .append($('<div>').addClass('subFields').hide())
      .appendTo(this.$parent);

    var self = this;
    this.fieldNameElm = this.$elm.find('.fieldName');
    this.subFieldsElm = this.$elm.find('.subFields');
    this.selectElm = this.$elm.find('select.fieldType');
    self.selectElm.change(function() {
      if(self.hasChildren()) {
        if(!self.subFieldGroup) {
          self.subFieldGroup = new FieldGroupElm(self.subFieldsElm);
        }
        self.subFieldsElm.show();
      } else {
        self.subFieldsElm.hide();
      }
    });
  }
  FieldElm.prototype.fieldName = function() {
    return this.fieldNameElm.val();
  };
  FieldElm.prototype.fieldType = function() {
    return this.selectElm.val();
  };
  FieldElm.prototype.value = function() {
    var val = { name: this.fieldName(), type: this.fieldType() };
    if(this.hasChildren()) {
      val.children = this.subFieldGroup.value();
    }
    return val;
  };
  FieldElm.prototype.hasChildren = function() {
    var fieldType = this.fieldType();
    return fieldType === 'array' || fieldType === 'object';
  };

  function FieldGroupElm($parent) {
    this.fields = [];

    this.$elm = $('<div>')
      .append($('<div>').addClass('fieldGroup'))
      .append($('<div>').addClass('addField').text('+ Add a new field'))
      .appendTo($parent);

    var fieldGroupElm = this.$elm.find('.fieldGroup');
    var self = this;
    this.$elm.find('.addField').click(function($event) {
      self.fields.push(new FieldElm(fieldGroupElm));
    });
  }
  FieldGroupElm.prototype.value = function() {
    return this.fields.map(function(field) {
      return field.value();
    })
  };

  ///////////////////////////////////////////////
  */




})(window, jQuery, _, React);