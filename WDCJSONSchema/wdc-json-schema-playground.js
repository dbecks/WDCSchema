
(function(ns, $, _, React, ReactBootstrap, TableauSchema, WDCSchema, WDCSchemaUI) {

  ///////////////////////////////////////////////////////////////////
  // Components

  var DOM        = React.DOM;
  var Field      = WDCSchemaUI.Field;
  var FieldGroup = WDCSchemaUI.FieldGroup;

  _.forEach(ReactBootstrap, function(component) {
    component.element = React.createFactory(component);
  });

  var Input = ReactBootstrap.Input;
  var Button = ReactBootstrap.Button;
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

    // Non-react methods
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

    // Non-react methods
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

  var tableRowKey = 1;
  var TablePreview = React.createClass({
    getInitialState: function () {
      var state = this.propsToState(this.props);
      this.notifyState(state);
      return state;
    },
    componentWillReceiveProps: function(nextProps) {
      var _this = this;
      this.setState(this.propsToState(nextProps), function() {
        _this.notifyState(_this.state);
      });
    },
    render: function () {
      var state = this.state;
      var headerName = Object.keys(state.headers); // Maintains the order

      if(headerName.length === 0) return Well.element(null, 'Cannot create table');
      if(this.props.errorMessage) return Well.element(null, this.props.errorMessage)

      var tableData = state.tableData.slice(0, TablePreview.MAX_ROWS).map(function(row) {
        return DOM.tr({ key: tableRowKey++ },
          headerName.map(function(headerName) {
            var tableCellValue = row[headerName];
            return DOM.td({ key: tableRowKey++ }, tableCellValue);
          })
        )
      });

      if(state.tableData.length > tableData.length) {
        tableData.push(
          DOM.tr({ key: tableRowKey++ },
            DOM.td({ colSpan: headerName.length }, 'Not all data displayed.  Only displaying the first ' + TablePreview.MAX_ROWS + ' rows for performance.')
          )
        );
      }

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
          DOM.tbody(null, tableData)
        )
      );
    },

    // Non-react methods
    propsToState: function(props) {
      var data = props.data;

      return {
        headers: WDCSchema.convertToTableHeaders(props.schema),
        tableData: WDCSchema.convertToTable(data, props.schema)
      };
    },
    notifyState: function(state) {
      if(this.props.onHeadersChange) this.props.onHeadersChange(state.headers);
      if(this.props.onTableChange) this.props.onTableChange(state.tableData);
    }
  });
  TablePreview.element = React.createFactory(TablePreview);
  TablePreview.MAX_ROWS = 100;

  var FetchData = React.createClass({
    render: function() {
      var submitButton = Button.element({ onClick: this.fetchData }, 'Fetch Data');

      return (
        Input.element({ type: 'text', ref: 'jsonAddress', onKeyPress: this.onKeyPress, buttonAfter: submitButton, placeholder: 'Address to JSON' })
      );
    },

    // Non-react methods
    onKeyPress: function(e) {
      if (e.key === 'Enter') {
        this.fetchData();
      }
    },
    fetchData: function() {
      if(!this.props.onData) return;

      var _this = this;

      $.get(this.refs.jsonAddress.getValue())
        .then(function(responseBody) {
          if(typeof responseBody !== 'object') {
            try {
              responseBody = JSON.parse(responseBody);
            } catch(e) {
              // Best effort, do nothing if fails
            }
          }

          if(responseBody.data) { // TODO: Should I expose this?
            console.log('Ajax full response:');
            console.log(responseBody);

            _this.props.onData(responseBody.data);
          } else {
            _this.props.onData(responseBody);
          }
        });
    }
  });
  FetchData.element = React.createFactory(FetchData);



  var SchemaPlaygroundApp = React.createClass({
    getInitialState: function () {
      var updateDataString = this.updateDataString; //_.debounce(this.updateDataString, SchemaPlaygroundApp.DEBOUNCE_TIME);
      var updateSchema = _.debounce(this.updateSchema, SchemaPlaygroundApp.DEBOUNCE_TIME);

      return {
        schema: [], dataString: '[]', data: [], errorMessage: '', updateDataString: updateDataString,
        updateSchema: updateSchema, onTableChange: this.onTableChange, sampleSize: SchemaPlaygroundApp.DEFAULT_SAMPLE_SIZE
      };
    },
    render: function () {
      var textAreaStyle = { height: '300px', maxWidth: '100%', minWidth: '100%' };
      var submitButton = null;
      if(this.props.onSubmit) {
        submitButton = Button.element({ onClick: this.submitData, disabled: this.submitDataDisabled() }, 'Submit Data');
      }

      return (
        Grid.element({ className: 'full-height', style: { paddingTop: '10px', paddingBottom: '10px' }, fluid: true },
          Col.element({ md: 4, className: 'fill-height' },
            FetchData.element({ onData: this.updateData }),
            Input.element({ type: 'textarea', style: textAreaStyle, onChange: this.onDataStringChange, value: this.state.dataString }),
            DOM.div({ className: 'form-inline' },
              Button.element({ onClick: this.generateSchema}, 'Generate the Schema')
              //Sample Size is just confusing
              //Input.element({
              //  type: 'number', label: 'Sample Size', onChange: this.onSampleSizeChange,
              //  value: this.state.sampleSize
              //})
            )
          ),
          Col.element({ md: 4, className: 'fill-height' },
            FieldGroup.element({ onFieldUpdate: this.onSchemaChange, value: this.state.schema })
          ),
          Col.element({ md: 4, className: 'fill-height' },
            submitButton,
            TablePreview.element(this.state)
            //TableHeaderPreview.element(this.state),
            //TableDataPreview.element(this.state)
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
      var schema = ns.WDCSchema.generateSchema(this.state.data, this.state.sampleSize || SchemaPlaygroundApp.DEFAULT_SAMPLE_SIZE);
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
        errorMessage = 'Invalid input data. Please use a valid JSON structure.';
      }

      this.setState({ dataString: dataString, data: data, errorMessage: errorMessage });
    },
    updateData: function(data) {
      this.setState({ dataString: JSON.stringify(data, null, 2), data: data, errorMessage: '' });
    },
    onTableChange: function(data) {
      if(this.props.onTableChange) this.props.onTableChange(data);
    },
    onSampleSizeChange: function(e) {
      this.setState({ sampleSize: e.target.value });
    },
    submitData: function() {
      if(!this.props.onSubmit) return;

      this.props.onSubmit(this.state.schema, this.state.data);
    },
    submitDataDisabled: function() {
      return !this.state.schema || (this.state.schema.length === 0)
          || !this.state.data || (this.state.data.length === 0)
    }
  });
  SchemaPlaygroundApp.DEFAULT_SAMPLE_SIZE = 10;
  SchemaPlaygroundApp.DEBOUNCE_TIME = 100;

  ////////////////////////////////////////////////////////////

  var isInAWDC = (window !== window.top) || (!!window.opener) // If this page was opened by another assume it's in a simulator
              || (window.navigator.userAgent.indexOf('Tableau') >= 0) // Or Tableau user agent

  if(isInAWDC) {
    TableauSchema
      .setup({
        fetchSetupData: function (cb) {
          $(function () {
            React.render(
              React.createElement(SchemaPlaygroundApp, { onSubmit: cb }),
              document.getElementById('fieldGroup')
            );
          });
        },

        fetchData: function (authentication, lastRecordToken, data, cb) {
          cb(data);
        }
      })
      .setConnectionName('Playground')
  } else {
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
      React.render(
        React.createElement(SchemaPlaygroundApp, { onSchemaChange: updateGlobalFieldGroup, onTableChange: updateGlobalDataTable }),
        document.getElementById('fieldGroup')
      );
    });
  }


})(window, jQuery, _, React, ReactBootstrap, TableauSchema, WDCSchema, WDCSchemaUI);
