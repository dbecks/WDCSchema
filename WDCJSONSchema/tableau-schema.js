
(function(window, $, _, tableau, WDCSchema) {

  function functionToPromise(fn, ctx) {
    var promise = $.Deferred();
    if (fn) {
      fn.call(ctx, promise.resolve);
    } else {
      promise.resolve();
    }
    return promise;
  }

  function setup(config) {
    var _schema, _metaData, _password, _connectionName;

    if(!config.fetchData) {
      throw new Error('setup requires a fetchData(password, lastRecordToken, data, cb) function.');
    }

    // Set up the password if one is needed
    var passwordPromise = functionToPromise(config.fetchPassword, config);

    // Set up the connector
    var connector = tableau.makeConnector();

    connector.init = function() {

      if(_connectionName) tableau.connectionName = _connectionName;

      if(tableau.phase === tableau.phaseEnum.gatherDataPhase) {
        // The password should already be set, do nothing here
        tableau.initCallback();
        return;
      }

      var operationsPromiseChain = passwordPromise;

      if (tableau.phase === tableau.phaseEnum.authPhase ||
          tableau.phase === tableau.phaseEnum.interactivePhase)
      {
        // Fetch password information
        operationsPromiseChain = operationsPromiseChain
          .then(function() { return passwordPromise; })
          .then(function(password) {
            if(password == null) password = _password;
            tableau.password = password;
          })
          .then(function()  { tableau.initCallback(); });
      }

      if(tableau.phase === tableau.phaseEnum.interactivePhase) {
        // fetch additional information if more information is needed.
        operationsPromiseChain
          .then(function() { return functionToPromise(config.fetchSetupData, config); })
          .then(function(schema, metaData) {
            if(schema == null) schema = _schema;
            if(metaData == null) metaData = _metaData;

            if(!schema) {
              throw new Error('A schema was never set. Please pass in a fetchSetupData handler to setup() or call context.setSchema() on the returned object');
            }

            tableau.connectionData = JSON.stringify({ schema: schema, metaData: metaData });
            tableau.submit();
          });
      }
    };

    connector.getColumnHeaders = function() {
      var connectionData = JSON.parse(tableau.connectionData);
      var headers = WDCSchema.convertToTableHeaders(connectionData.schema);
      var fieldNames = Object.keys(headers);
      var fieldTypes = fieldNames.map(function(key) { return headers[key]; });

      tableau.headersCallback(fieldNames, fieldTypes);
    };

    connector.getTableData = function(lastRecordToken) {
      var connectionData = JSON.parse(tableau.connectionData);

      // TODO: Create a way to pass in errors or pass in progress if reading in a lot of data, maybe give a deffered? or is that too complicated?
      config.fetchData(tableau.password, lastRecordToken, connectionData.metaData, function(resultData, lastRecordToken) {
        var tableData = WDCSchema.convertToTable(resultData, connectionData.schema);

        tableau.dataCallback(tableData, lastRecordToken, false);
      });
    };

    tableau.registerConnector(connector);

    return {
      setSchema: function(schema) {
        _schema = schema;
      },
      setConnectionName: function(name) {
        _connectionName = name;
      },
      setConnectionData: function(metaData) {
        _metaData = metaData;
      },
      getConnectionData: function() {
        if(typeof _metaData !== 'object') return _metaData;

        // Return a deep clone to keep _data immutable
        return $.extend(true, Array.isArray(_metaData) ? [] : {}, data);
      }
    }
  }

  window.TableauSchema = {
    setup: setup
  }

})(window, jQuery, _, tableau, WDCSchema);