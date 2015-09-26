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

(function(ns, $, _, React, ReactBootstrap, WDCSchema, WDCSchemaUI) {

  var DOM        = React.DOM;
  var Field      = WDCSchemaUI.Field;
  var FieldGroup = WDCSchemaUI.FieldGroup;

  _.forEach(ReactBootstrap, function(component) {
    component.element = React.createFactory(component);
  });

  var Input = ReactBootstrap.Input;
  var ButtonInput = ReactBootstrap.ButtonInput;
  var Well = ReactBootstrap.Well;
  var Grid = ReactBootstrap.Grid;
  var Row = ReactBootstrap.Row;
  var Col = ReactBootstrap.Col;

  var TableHeaderPreview = React.createClass({
    getInitialState: function () {
      return this.propsToState(this.props);
    },
    render: function () {
      return (
        this.state.errorMessage
          ? Well.element({ bsSize: 'small' }, this.state.errorMessage)
          : DOM.pre(null, this.state.previewText)
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
  TableHeaderPreview.element = React.createFactory(TableHeaderPreview);

  var TableDataPreview = React.createClass({
    getInitialState: function () {
      var state = this.propsToState(this.props);
      if(this.props.onTableChange) this.props.onTableChange(state.previewTable);

      return state;
    },
    render: function () {
      return (
        this.state.errorMessage
          ? Well.element({ bsSize: 'small' }, this.state.errorMessage)
          : DOM.pre(null, this.state.previewText)
      );
    },
    componentWillReceiveProps: function(nextProps) {
      var prevPreviewTable = this.state.previewTable;
      var state = this.propsToState(nextProps);
      this.setState(state, function() {
        if(this.props.onTableChange && !_.isEqual(prevPreviewTable, state.previewTable)) {
          this.props.onTableChange(state.previewTable);
        }
      });
    },
    ////////////////////////////////////////////
    propsToState: function(props) {
      var previewText = '';
      var previewTable = [];
      var errorMessage = props.errorMessage;
      if(!errorMessage) {
        try {
          previewTable = WDCSchema.convertToTable(props.data, props.schema);
          previewText = JSON.stringify(previewTable, null, 2);
        } catch (e) {
          console.error(e);
          errorMessage = e.message;
        }
      }
      return { previewTable: previewTable, previewText: previewText, errorMessage: errorMessage };
    }
  });
  TableDataPreview.element = React.createFactory(TableDataPreview);

  function mapObject(obj, iteratee, ctx) { return _.chain(obj).mapObject(iteratee, ctx).values().value(); }
  var Table = ReactBootstrap.Table;
  var Panel = ReactBootstrap.Panel;

  var tableRowKey = 1;
  var TablePreview = React.createClass({
    getInitialState: function () {
      return this.propsToState(this.props);
    },
    componentWillReceiveProps: function(nextProps) {
      this.setState(this.propsToState(nextProps));
    },
    render: function () {
      var state = this.state;
      var headerName = Object.keys(state.headers); // Maintains the order


      if(headerName.length === 0) return Well.element(null, 'Cannot create table')

      return (
        Table.element({ bordered: true, condensed: true },
          DOM.thead(null,
            DOM.tr(null,
              headerName.map(function(headerName) {
                var type = state.headers[headerName];
                return DOM.th({ key: tableRowKey++ }, headerName + ' (' + type + ')');
              })
            )
          ),
          DOM.tbody(null,
            state.tableData.map(function(row) {
              return DOM.tr({ key: tableRowKey++ },
                headerName.map(function(headerName) {
                  var tableCellValue = row[headerName];
                  return DOM.td({ key: tableRowKey++ }, tableCellValue);
                })
              )
            })
          )
        )
      );
    },

    propsToState: function(props) {
      return {
        headers: WDCSchema.convertToTableHeaders(props.schema),
        tableData: WDCSchema.convertToTable(props.data, props.schema)
      };
    }
  });
  TablePreview.element = React.createFactory(TablePreview);

  var SchemaPreviewApp = React.createClass({
    getInitialState: function () {
      var updateDataString = this.updateDataString; //_.debounce(this.updateDataString, SchemaPreviewApp.DEBOUNCE_TIME);
      var updateSchema = _.debounce(this.updateSchema, SchemaPreviewApp.DEBOUNCE_TIME);

      return {
        schema: [], dataString: '[]', data: [], errorMessage: '', updateDataString: updateDataString,
        updateSchema: updateSchema, onTableChange: this.onTableChange
      };
    },
    render: function () {
      var textAreaStyle = { height: '300px', maxWidth: '100%', minWidth: '100%' };

      return (
        Grid.element({ className: 'full-height', fluid: true },
          Row.element({ className: 'full-height', style: { paddingTop: '10px', paddingBottom: '10px' } },
            Col.element({ md: 4, className: 'fill-height' },
              Input.element({ type: 'textarea', style: textAreaStyle, onChange: this.onDataStringChange, value: this.state.dataString }),
              ButtonInput.element({ onClick: this.generateSchema, value: 'Generate the Schema' })
            ),
            Col.element({ md: 4, className: 'fill-height' },
              FieldGroup.element({ onFieldUpdate: this.onSchemaChange, value: this.state.schema })
            ),
            Col.element({ md: 4, className: 'fill-height' },
              TablePreview.element(this.state)
              //TableDataPreview.element(this.state)
            )
          )
        )
      );
    },
    /////////////////////////////////////////////////
    onSchemaChange: function(schema) {
      this.state.updateSchema(schema);
    },
    updateSchema: function(schema) {
      this.setState({ schema: schema }, function() {
        if(this.props.onSchemaChange) this.props.onSchemaChange(schema);
      });
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
    },
    onTableChange: function(data) {
      if(this.props.onTableChange) this.props.onTableChange(data);
    }
  });
  SchemaPreviewApp.DEBOUNCE_TIME = 100;

  ////////////////////////////////////////////////////////////
  // TODO: Move the following to a separate file

  function updateGlobalFieldGroup(fieldGroup) {
    ns.fieldGroup = fieldGroup;
  }

  function updateGlobalDataTable(table) {
    ns.dataTable = table;
  }

  ns.getHeaders = function() {
    return WDCSchema.convertToTableHeaders(ns.fieldGroup);
  };

  $(function() {
    //ns.fieldGroup = new FieldGroupElm($('body'));
    React.render(
      React.createElement(SchemaPreviewApp, { onSchemaChange: updateGlobalFieldGroup, onTableChange: updateGlobalDataTable }),
      document.getElementById('fieldGroup')
    );
  });

})(window, jQuery, _, React, ReactBootstrap, WDCSchema, WDCSchemaUI);
