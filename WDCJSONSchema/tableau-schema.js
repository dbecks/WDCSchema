
(function(window, $, _, tableau, WDCSchema) {

  function functionToPromise(fn, ctx) {
    var promise = $.Deferred();
    var args = _.toArray(arguments).slice(2);
    if (fn) {
      fn.apply(ctx, args.concat([promise.resolve]));
    } else {
      promise.resolve();
    }
    return promise;
  }

  function setup(config) {
    var _schema, _metaData, _connectionName;
    var _password = tableau.password;
    var _username = tableau.username;

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
          .then(function(authentication) {
            authentication = authentication || {};

            if(_.isString(authentication.password)) _password = authentication.password;
            if(_.isString(authentication.username)) _username = authentication.username;

            tableau.password = _password;
            tableau.username = _username;
          })
          .then(function()  { tableau.initCallback(); });
      }

      if(tableau.phase === tableau.phaseEnum.interactivePhase) {
        // fetch additional information if more information is needed.
        operationsPromiseChain
          .then(function() { return functionToPromise(config.fetchSetupData, config, { password: _password, username: _username }); })
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

      var authentication = {
        username: tableau.username,
        password: tableau.password
      };

      // TODO: Create a way to pass in errors or pass in progress if reading in a lot of data, maybe give a deffered? or is that too complicated?
      config.fetchData(authentication, lastRecordToken, connectionData.metaData, function(resultData, lastRecordToken) {
        var tableData = WDCSchema.convertToTable(resultData, connectionData.schema);

        tableau.dataCallback(tableData, lastRecordToken, false);
      });
    };

    tableau.registerConnector(connector);

    var context = {
      setSchema: function(schema) {
        _schema = schema;
        return context; // for chaining
      },
      setConnectionName: function(name) {
        _connectionName = name;
        return context; // for chaining
      }
    };

    return context;
  }

  window.TableauSchema = {
    setup: setup
  }

})(window, jQuery, _, tableau, WDCSchema);