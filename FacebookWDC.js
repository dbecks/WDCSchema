(function(window, $, _, WDCSchema, WDCSchemaUI) {

  // States
  var documentReady = $.Deferred();
  var fbConnected = $.Deferred();
  var fbNotAuthorized = $.Deferred();
  var fbNotLoggedIn = $.Deferred();
  var fbHasLoginStatus = $.Deferred();
  var wdcGatherDataPhase = $.Deferred();
  var wdcInteractivePhase = $.Deferred();
  var wdcAuthPhase = $.Deferred();

  // Facebook methods
  var DEFAULT_CLIENT_ID = '107253586284463'; // David Becker's App ID
  //var DEFAULT_CLIENT_ID = "475960835902299"; // This is Samm's personal app id
  //var DEFAULT_CLIENT_ID = "131331403865338"; // This is the the Tableau id that Francois put in

  var scope = [
    "user_friends",
    "email",
    "user_about_me",
    "user_actions.books",
    "user_actions.fitness",
    "user_actions.music",
    "user_actions.news",
    "user_actions.video",
    //"user_actions:{app_namespace}",
    "user_birthday",
    "user_education_history",
    "user_events",
    "user_games_activity",
    "user_groups",
    "user_hometown",
    "user_likes",
    "user_location",
    "user_managed_groups",
    "user_photos",
    "user_posts",
    "user_relationships",
    "user_relationship_details",
    "user_religion_politics",
    "user_status",
    "user_tagged_places",
    "user_videos",
    "user_website",
    "user_work_history",
    "read_custom_friendlists",
    "read_insights",
    //"read_audience_network_insights",
    "read_mailbox",
    "read_page_mailboxes",
    "read_stream",
    "manage_notifications",
    "manage_pages",
    "publish_pages",
    "publish_actions",
    "rsvp_event",
    "ads_read",
    "ads_management"
  ];

  var DEFAULT_REQUESTED_SCOPE = scope.join(',');
  var FACEBOOK_OAUTH = 'https://www.facebook.com/dialog/oauth';

  var FB_AUTH_STATUS = {
    CONNECTED: 'connected',
    NOT_AUTHORIZED: 'not_authorized'
  };

  function authenticate() {
    var oauthParams = {
      response_type : 'token',
      client_id     : DEFAULT_CLIENT_ID,
      redirect_uri  : window.location.href, // Navigate back here
      scope         : DEFAULT_REQUESTED_SCOPE
    };

    var fbAuthURL = FACEBOOK_OAUTH + '?' + $.param(oauthParams);

    window.location.href = fbAuthURL;
  }

  FB.init({
    appId   : DEFAULT_CLIENT_ID,
    cookie  : true,  // enable cookies to allow the server to access the session
    xfbml   : false, // parse social plugins on this page is not needed
    version : 'v2.3' // use version 2.3
  });

  FB.getLoginStatus(function(response) {
    switch(response.status) {
      case FB_AUTH_STATUS.CONNECTED:
        tableau.password = response.authResponse.accessToken;
        fbConnected.resolve();
        break;
      case FB_AUTH_STATUS.NOT_AUTHORIZED:
        fbNotAuthorized.resolve();
        break;
      default:
        fbNotLoggedIn.resolve();
        break;
    }

    fbHasLoginStatus.resolve();
  });

  function fetchFBData(fbRestApi, params, cb) {
    // TODO get this to work with response.cursors and offset
    if(_(params).isFunction()) {
      cb = params;
      params = {};
    }

    params = $.extend({ access_token: tableau.password }, params);
    var limit = params.limit;

    FB.api(fbRestApi, params, function(response) {
      if (response.error) {
        cb(response.error);
        return;
      }

      /*
      if(response.data) {
        var since, until, offset;
        if(response.paging) {
          if(response.paging.previous) {
            sinceMatch =  response.paging.previous.match(/since=([^&]*)/);
            since = sinceMatch && sinceMatch[0];
          }


          if(response.paging.next) {
            var untilMatch = response.paging.next.match(/until=([^&]*)/);
            until = untilMatch && untilMatch[1];

            var offsetMatch = response.paging.next.match(/offset=([^&]*)/);
            offset = offsetMatch && offsetMatch[1];
          }

        }

        var numRecords = response.data.length;
        if(0 < numRecords && numRecords < limit) {
          if(params.paging && params.paging.until == until) { //If both until values are the same then we're at the end
            cb(null, { data: [], paging: { since: since, until: until, offset: offset } });
            return;
          }

          // get more data
          var nestedParams = { until: until, limit: (limit - numRecords), offset: offset };
          fetchFBData(fbRestApi, nestedParams, function(err, result) {
            if(err) return cb(err);

            var totalData = response.data.concat(result.data);
            cb(null, { data: totalData, paging: { since: since, until: result.paging.until, offset: offset } });
          });
        } else {
          cb(null, { data: response.data, paging: { since: since, until: until, offset: offset } });
        }
      } else {
        cb(null, { data: [ response ] }); // The response is an object that has all of the data needed
      }
      */

      if(response.data) {

        var numRecords = response.data.length;
        var next = response.paging && response.paging.next;
        if(0 < numRecords && numRecords < limit && next) {

          // get more data
          fetchFBData(next, function(err, result) {
            if(err) return cb(err);

            var totalData = response.data.concat(result.data);
            cb(null, { data: totalData });
          });
        } else {
          cb(null, { data: response.data });
        }
      } else {
        cb(null, { data: [ response ] }); // The response is an object that has all of the data needed
      }
    });
  }

  tableau.connectionName = 'Facebook';

  // Set up action handlers

  function renderElement(clazz, props) {
    React.render(React.createElement(clazz, props), document.getElementById('appRoot'));
  }

  $.when(documentReady, fbConnected, wdcInteractivePhase).then(function() {
    // Display schema UI
    renderElement(FacebookWDCApp, null);
  });

  function warnNotAuthorizedAndLogin() {
    // Display warning that user is not authorized and login button
    renderElement(FacebookLogin, { warningMessage: 'Current logged in user is not authorized. Please login as a different user.' });
  }
  $.when(documentReady, fbNotAuthorized, wdcInteractivePhase).then(warnNotAuthorizedAndLogin);
  $.when(documentReady, fbNotAuthorized, wdcAuthPhase).then(warnNotAuthorizedAndLogin);

  function displayAuthButton() {
    // Display warning that user is not authorized and login button
    renderElement(FacebookLogin, null);
  }
  $.when(documentReady, fbNotLoggedIn, wdcInteractivePhase).then(displayAuthButton);
  $.when(documentReady, fbConnected, wdcAuthPhase).then(displayAuthButton); // Show login again even if currently logged in
  $.when(documentReady, fbNotLoggedIn, wdcAuthPhase).then(displayAuthButton);

  $.when(wdcGatherDataPhase, fbConnected).then(function() {
    // gather data,
    // or do nothing because that's handled by the connector?... that seems weird
  });

  $.when(wdcGatherDataPhase, fbNotAuthorized).then(function() {
    tableau.abortWithError('Requested data with an unauthorized user. Please re-authenticate to gather data.')
  });

  $.when(wdcGatherDataPhase, fbNotLoggedIn).then(function() {
    tableau.abortWithError('Requested data with out a logged in user. Please re-authenticate to gather data.')
  });

  // Set up action calls

  $(function() {
    documentReady.resolve();
  });

  var connector = tableau.makeConnector();

  connector.init = function() {
    switch(tableau.phase) {
      case tableau.phaseEnum.interactivePhase:
        wdcInteractivePhase.resolve();
        break;
      case tableau.phaseEnum.authPhase:
        wdcAuthPhase.resolve();
        break;
      case tableau.phaseEnum.gatherDataPhase:
        wdcGatherDataPhase.resolve();
        break;
    }

    if(!tableau.password) {
      // Wait for FB status.  Should return cached response if already returned from server
      FB.getLoginStatus(function(response) {
        if(response.status === FB_AUTH_STATUS.CONNECTED) {
          tableau.password = response.authResponse.accessToken;
        }
        tableau.initCallback();
      });
    } else {
      tableau.initCallback();
    }

  };

  connector.getColumnHeaders = function() {
    var connectionData = JSON.parse(tableau.connectionData);
    var headers = WDCSchema.convertToTableHeaders(connectionData.schema);
    var fieldNames = _.keys(headers);
    var fieldTypes = _.values(headers);

    tableau.headersCallback(fieldNames, fieldTypes);
  };

  connector.getTableData = function(lastRecordToken) {
    var connectionData = JSON.parse(tableau.connectionData);

    fetchFBData(connectionData.fbApi, { limit: connectionData.maxObjectCount, until: lastRecordToken }, function(err, result) {
      if(err) {
        tableau.abortWithError(buildError(connectionData.fbApi, err));
        return;
      }

      var tableData = WDCSchema.convertToTable(result.data, connectionData.schema);
      var lastRecordToken = result.paging && result.paging.since;

      tableau.dataCallback(tableData, lastRecordToken, false);
    });
  };

  tableau.registerConnector(connector);

  /////////////////////////////////////////////////////////
  // Components
  /////////////////////////////////////////////////////////

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
  var Col = ReactBootstrap.Col;
  var Alert = ReactBootstrap.Alert;

  var FieldGroup = WDCSchemaUI.FieldGroup;

  var fbAPIs = [
    '',
    'accounts',
    'achievements',
    'adaccounts',
    'adcontracts',
    'admined_groups',
    'adnetworkanalytics',
    'albums',
    'apprequests',
    'apprequestformerrecipients',
    'books',
    'domains',
    'events',
    'stream_filters',
    'friendlists',
    'ids_for_business',
    'invitable_friends',
    'games',
    'groups',
    'likes',
    'movies',
    'music',
    'objects',
    'permissions',
    'photos',
    'picture',
    'tagged_places',
    'promotable_domains',
    'promotable_events',
    'taggable_friends',
    'television',
    'videos',
    'video_broadcasts',
    'applications/developer',
    'checkins',
    'family',
    'feed',
    'friendrequests',
    'friends',
    'home',
    'inbox',
    'locations',
    'mutualfriends',
    'notifications',
    'outbox',
    'questions',
    'scores',
    'subscribers',
    'subscribedto'
  ];

  var FacebookAPIEdgeSelect = React.createClass({
    render: function() {
      var selectProps = $.extend({}, this.props);
      selectProps.type = 'select';

      return (
        Input.element(selectProps,
          fbAPIs.map(function(fbAPI) {
            return DOM.option({ key: fbAPI, value: fbAPI }, fbAPI);
          })
        )
      );
    }
  });
  FacebookAPIEdgeSelect.element = React.createFactory(FacebookAPIEdgeSelect);

  function buildError(requestPath, fbError) {
    /*
     var fbError =  {
       "message": "(#15) This method is only accessible to Games.",
       "type": "OAuthException",
       "code": 15
     }
     */

    return 'Error calling "' + requestPath + '", ' + fbError.type + ' (' + fbError.code + '): ' + fbError.message;
  }

  var FacebookWDCApp = React.createClass({
    getInitialState: function () {
      return {
        pageId: '/me', edgeApi: '', maxObjectCount: 100,
        sampleSize: 10, sampleData: [], sampleDataString: '[]',
        schema: [], errorMessage: ''
      };
    },
    render: function () {

      return (
        Grid.element({ fluid: true },
          Row.element(null,
            Input.element({ type: 'text', label: 'Please select the page ID', onChange: this.onFbPageIdChange, value: this.state.pageId }),
            FacebookAPIEdgeSelect.element({ label: 'Please select your Facebook API', onChange: this.onFbApiEdgeChange, value: this.state.edgeApi }),
            Input.element({ type: 'number', label: 'Max number of items', onChange: this.onMaxObjectCountChange, value: this.state.maxObjectCount })
          ),
          Row.element(null,
            Col.element({ md: 6 },
              DOM.div({ className: 'form-inline' },
                Input.element({ type: 'number', label: 'Sample Size', onChange: this.onSampleSizeChange, value: this.state.sampleSize }),
                ButtonInput.element({  value: 'Fetch Sample', onClick: this.fetchSample })
              ),
              this.state.errorMessage
                ? Alert.element({ bsStyle: 'warning' }, this.state.errorMessage)
                : DOM.pre(null, this.state.sampleDataString)
            ),
            Col.element({ md: 6 },
              DOM.div({ className: 'form-inline' },
                ButtonInput.element({ onClick: this.generateSchema, value: 'Generate the Schema' }),
                ButtonInput.element({ onClick: this.submit, value: 'Submit Data' })
              ),
              FieldGroup.element({ onFieldUpdate: this.onSchemaChange, value: this.state.schema })
            )
          )
        )
      );
    },
    //////////////////////////////////////////////////////
    onFbPageIdChange: function(e) {
      this.setState({ pageId: e.target.value });
    },
    onFbApiEdgeChange: function(e) {
      this.setState({ edgeApi: e.target.value });
    },
    onMaxObjectCountChange: function(e) {
      this.setState({ maxObjectCount: e.target.value });
    },
    onSampleSizeChange: function(e) {
      this.setState({ sampleSize: e.target.value });
    },
    getFBApi: function() {
      var pageId = this.state.pageId;
      var edgeApi = this.state.edgeApi;

      var fbRestApi = pageId;
      if(edgeApi) fbRestApi += '/' + edgeApi;

      return fbRestApi;
    },
    fetchSample: function() {
      var _this = this;
      var api = this.getFBApi();
      fetchFBData(api, { limit: this.state.sampleSize }, function(err, result) {
        if(err) {
          _this.setState({ sampleData: [], sampleDataString: '[]', errorMessage: buildError(api, err) });
        } else {
          _this.setState({ sampleData: result.data, sampleDataString: JSON.stringify(result.data, null, 2), errorMessage: '' });
        }
      });
    },
    generateSchema: function() {
      var schema = WDCSchema.generateSchema(this.state.sampleData, this.state.sampleSize);
      this.onSchemaChange(schema);
    },
    onSchemaChange: function(schema) {
      this.setState({ schema: schema });
    },
    submit: function() {
      if(this.state.schema.length === 0) return;

      //TODO: Set values on tableau.connectionData
      var connectionData = {
        fbApi: this.getFBApi(),
        maxObjectCount: this.state.maxObjectCount,
        schema: this.state.schema

      };
      tableau.connectionData = JSON.stringify(connectionData);
      tableau.submit();
    }
  });
  FacebookWDCApp.element = React.createFactory(FacebookWDCApp);

  var FacebookLogin = React.createClass({
    render: function() {
      var warning = null;
      if(this.props.warningMessage) {
        warning = (
          Alert.element({ bsStyle: 'warning' },
            this.props.warningMessage
          )
        )
      }

      return (
        DOM.div(null,
          warning,
          ButtonInput.element({ onClick: this.onClick, value: 'Login' })
        )
      );
    },
    onClick: function() {
      authenticate();
    }
  });
  FacebookLogin.element = React.createFactory(FacebookLogin);

  window.FBWDC = {
    authenticate: authenticate
  };

})(window, jQuery, _, WDCSchema, WDCSchemaUI);