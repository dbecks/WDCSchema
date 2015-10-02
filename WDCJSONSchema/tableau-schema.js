
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

  function getAuthentication() {
    return {
      password: tableau.password,
      username: tableau.username
    };
  }

  function setup(config) {
    var _schema, _metaData, _connectionName;
    var _authentication = {
      password: tableau.password,
      username: tableau.username
    };

    if(!config.fetchData) {
      throw new Error('setup requires a fetchData(password, lastRecordToken, data, cb) function.');
    }

    // Set up the connector
    var connector = tableau.makeConnector();

    connector.init = function() {

      if(_connectionName) tableau.connectionName = _connectionName;

      if(tableau.phase === tableau.phaseEnum.gatherDataPhase) {
        // The password should already be set, do nothing here
        tableau.initCallback();
        return;
      }

      var operationsPromiseChain = $.Deferred().resolve();

      if (tableau.phase === tableau.phaseEnum.authPhase ||
          tableau.phase === tableau.phaseEnum.interactivePhase)
      {
        // Fetch password information
        operationsPromiseChain = operationsPromiseChain
          // Set up the password if one is needed
          .then(function() { return functionToPromise(config.fetchPassword, config); })
          .then(function(authentication) {
            authentication = authentication || {};

            if(_.isString(authentication.password)) tableau.password = authentication.password;
            if(_.isString(authentication.username)) tableau.username = authentication.username;
          })
          .then(function() { tableau.initCallback(); });
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

      tableau.log('GotHere for headers');

      tableau.headersCallback(fieldNames, fieldTypes);
    };

    connector.getTableData = function(lastRecordToken) {
      var connectionData = JSON.parse(tableau.connectionData);

      tableau.log('GotHere getTableData');

      // TODO: Create a way to pass in errors or pass in progress if reading in a lot of data, maybe give a deffered? or is that too complicated?
      config.fetchData(getAuthentication(), lastRecordToken, connectionData.metaData, function(resultData, lastRecordToken) {
        var tableData = WDCSchema.convertToTable(resultData, connectionData.schema);

        tableau.log('GotHere with tableData');

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
      },
      getAuthentication: getAuthentication
    };

    return context;
  }

  var isInWDC = (window !== window.top) || (!!window.opener) // If this page was opened by another assume it's in a simulator
             || (typeof tableauVersionBootstrap !== 'undefined') // Or we may be in the real thing, same check from tableauwdc

  window.TableauSchema = {
    setup: setup,
    isInWDC: isInWDC
  }

})(window, jQuery, _, tableau, WDCSchema);