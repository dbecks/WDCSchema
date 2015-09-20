(function(window, _, React, ReactBootstrap, WDCSchema) {

  var FIELD_TYPE = WDCSchema.FIELD_TYPE;
  var DOM = React.DOM;

  _.forEach(ReactBootstrap, function(component) {
    component.element = React.createFactory(component);
  });

  var Input = ReactBootstrap.Input;
  var ButtonInput = ReactBootstrap.ButtonInput;
  var Panel = ReactBootstrap.Panel;
  var ListGroup = ReactBootstrap.ListGroup;
  var ListGroupItem = ReactBootstrap.ListGroupItem;
  var Grid = ReactBootstrap.Grid;
  var Row = ReactBootstrap.Row;


  var FieldTypeSelect = React.createClass({
    render: function() {
      var fields = _(FieldTypeSelect.TYPE_LIST).difference(this.props.without);
      var inputProps = _.clone(this.props);
      inputProps.type = 'select';

      return (
        Input.element(inputProps,
          fields.map(function(fieldType) {
            return DOM.option({ key: fieldType, value: fieldType }, fieldType);
          })
        )
      );
    }
  });
  FieldTypeSelect.element = React.createFactory(FieldTypeSelect);
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
        fieldGroup = (
          Row.element({ className: 'subFields' },
            FieldGroup.element({
              value: this.state.field.subFields,
              //className: 'subFields',
              onFieldUpdate: this.onSubFieldGroupUpdate
            })
          )
        );
      }

      var arrayType = null;
      if(this.hasArrayType()) {
        arrayType = (
          Row.element(null,
            DOM.div({ className: 'fieldArrayType form-inline' },
              FieldTypeSelect.element(
                {
                  value: this.state.field.arrayType,
                  label: 'Array Type: ',
                  without: [Field.TYPE.array],
                  onChange: this.onArrayFieldTypeChange
                }
              )
            )
          )
        );
      }

      return (
        Grid.element({ fluid: true },
          Row.element(null,
            DOM.div({ className: 'form-inline' },
              Input.element({ type: 'text', className: 'fieldName', value: this.state.field.name, onChange: this.onFieldNameChange }),
              FieldTypeSelect.element({ className: 'fieldType', value: this.state.field.type, onChange: this.onFieldTypeChange }),
              ButtonInput.element({ className: 'fieldDelete', onClick: this.props.onFieldDelete }, 'Delete')
            )
          ),
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
  Field.element = React.createFactory(Field);
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
        Panel.element(null,
          ListGroup.element({ fill: '' },
            this.state.fields.map(function(field) {
              return (
                ListGroupItem.element({ key: field.key },
                  Field.element({
                    field: field, key: field.key,
                    onFieldUpdate: _this.onFieldUpdateFactory(field),
                    onFieldDelete: _this.removeField(field)
                  })
                )
              );
            }),
            ListGroupItem.element({ onClick: this.addField }, '+ Add a new field')
          )
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
      this.setFields(fields);
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
  FieldGroup.element = React.createFactory(FieldGroup);

  window.WDCSchemaUI = {
    Field: Field,
    FieldGroup: FieldGroup
  }

})(window, _, React, ReactBootstrap, WDCSchema);