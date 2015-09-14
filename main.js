/*
TODO:
X allow a way to set type for array to any other type
X create method that takes input JSON and schema to a flat table
X create method that takes schema and generates the header
- hook up to an API

BONUS:
X pass in a JSON to generate the initial schema
- create a way to join multiple requests to create the table
 */

(function(ns, $, _, React) {

  var FIELD_TYPE = WDCSchema.FIELD_TYPE;
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
      var field = this.props.field
                ? _.clone(this.props.field)
                : { name: '', type: Field.DEFAULT_TYPE };
      return { field : field };
    },
    componentWillReceiveProps: function(nextProps) {
      if(nextProps.field) {
        this.setState({ field: _.clone(nextProps.field) });
      }
    },
    render: function() {
      var fieldGroup = null;
      if(this.hasSubFields()) {
        fieldGroup = FieldGroup.factory({
          value: this.state.field.subFields,
          className: 'subFields',
          onFieldUpdate: this.onSubFieldGroupUpdate
        });
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

  var fieldGroupFieldKey = 1; // static variable used to create a unique key for each field created
  var FieldGroup = React.createClass({
    getInitialState: function() {
      return { fields: this.getFieldsFromProps(this.props) };
    },
    componentWillReceiveProps: function(nextProps) {
      if(_(nextProps.value).isArray()) { // Don't remove previous props
        this.setState({ fields: this.getFieldsFromProps(nextProps) });
      }
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
        var fields = _.clone(_this.state.fields);
        fields.splice(fields.indexOf(field), 1); // Remove the field

        _this.setFields(fields);
      }
    },
    onFieldUpdateFactory: function(field) {
      var _this = this;
      return function(fieldUpdate) {
        _.extend(field, fieldUpdate);
        _this.setFields(_this.state.fields);
      };
    },
    getFieldsFromProps: function(props) {
      if(!_(props.value).isArray()) return [];

      var fields = props.value.map(_.clone);
      fields.forEach(function(field) {
        if(!field.key) field.key = fieldGroupFieldKey++;
      });
      return fields;
    }
  });
  FieldGroup.factory = React.createFactory(FieldGroup);

  ////////////////////////////////////////////////////////////////

  var HeaderPreview = React.createClass({
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
      var errorMessage = props.errorMessage;
      if(!errorMessage) {
        try {
          var previewTable = WDCSchema.convertToTableHeaders(props.schema);
          previewText = JSON.stringify(previewTable, null, 2);
        } catch (e) {
          console.error(e);
          errorMessage = e.message;
        }
      }
      return { previewText: previewText, errorMessage: errorMessage };
    }
  });
  HeaderPreview.factory = React.createFactory(HeaderPreview);

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
      var errorMessage = props.errorMessage;
      if(!errorMessage) {
        try {
          var previewTable = WDCSchema.convertToTable(props.data, props.schema);
          previewText = JSON.stringify(previewTable, null, 2);
        } catch (e) {
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
      var updateDataString = _.debounce(this.updateDataString, SchemaPreviewApp.DEBOUNCE_TIME);
      var updateSchema = _.debounce(this.updateSchema, SchemaPreviewApp.DEBOUNCE_TIME);

      return { schema: [], dataString: '[]', data: [], errorMessage: '', updateDataString: updateDataString, updateSchema: updateSchema };
    },
    render: function () {
      return (
        DOM.div({ style: { height: '100%', width: '100%' } },
          DOM.div({ className: 'previewColumn' },
            FieldGroup.factory({ onFieldUpdate: this.onSchemaChange, value: this.state.schema })
          ),
          DOM.div({ className: 'previewColumn' },
            DOM.textarea({ style: { height: '300px', width: '98%' }, onChange: this.onDataStringChange, value: this.state.dataString }),
            DOM.button({ onClick: this.generateSchema }, 'Generate the Schema')
          ),
          DOM.div({ className: 'previewColumn' },
            HeaderPreview.factory(this.state),
            TablePreview.factory(this.state)
          )
        )
      );
    },
    /////////////////////////////////////////////////
    onSchemaChange: function(schema) {
      this.state.updateSchema(schema);
    },
    updateSchema: function(schema) {
      this.setState({ schema: schema });
      ns.fieldGroup = schema;
    },
    generateSchema: function() {
      var schema = ns.WDCSchema.generateSchema(this.state.data, 50);
      this.setState({ schema: schema });
    },
    onDataStringChange: function(event) {
      this.state.updateDataString(event.target.value);
    },
    updateDataString: function(dataString) {
      var data = [];
      var errorMessage = '';
      try {
        data = JSON.parse(dataString);
      } catch(e) {
        errorMessage = 'Invalid preview input data';
      }

      this.setState({ dataString: dataString, data: data, errorMessage: errorMessage });
    }
  });
  SchemaPreviewApp.DEBOUNCE_TIME = 100;

  ////////////////////////////////////////////////////////////
  // TODO: Move the following to a separate file

  function updateGlobalFieldGroup(fieldGroup) {
    ns.fieldGroup = fieldGroup;
  }

  ns.getHeaders = function() {
    return WDCSchema.convertToTableHeaders(ns.fieldGroup);
  };

  $(function() {
    //ns.fieldGroup = new FieldGroupElm($('body'));
    React.render(
      React.createElement(SchemaPreviewApp),
      document.getElementById('fieldGroup')
    );
  });

})(window, jQuery, _, React);
