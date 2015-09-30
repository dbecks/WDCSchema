(function(window, $, _, React, ReactBootstrap, TableauSchema, WDCSchema, WDCSchemaUI) {

  /////////////////////////////////////////////////////////
  // Facebook methods
  /////////////////////////////////////////////////////////

  var DEFAULT_CLIENT_ID = '107253586284463'; // David Becker's App ID
  //var DEFAULT_CLIENT_ID = "475960835902299"; // This is Samm's personal app id
  //var DEFAULT_CLIENT_ID = "131331403865338"; // This is the the Tableau id that Francois put in

  var DEFAULT_FB_VERSION = 'v2.3';

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

  function authenticate(clientId, version, scope) {

    var oauthParams = {
      response_type : 'code', // Use code so it will return state back.
      client_id     : clientId,
      redirect_uri  : window.location.href, // Navigate back here
      scope         : scope,
      state         : JSON.stringify({ clientId: clientId, version: version })
    };

    var fbAuthURL = FACEBOOK_OAUTH + '?' + $.param(oauthParams);

    window.location.href = fbAuthURL;
  }

  function getAccessToken(clientId, version, cb) {
    FB.init({
      appId   : clientId,
      cookie  : false,  // enable cookies to allow the server to access the session
      xfbml   : false, // parse social plugins on this page is not needed
      version : version // use version 2.3
    });

    FB.getLoginStatus(function(fbLoginStatus) {
      if(fbLoginStatus && (fbLoginStatus.status === FB_AUTH_STATUS.CONNECTED) && fbLoginStatus.authResponse) {
        cb(fbLoginStatus.authResponse.accessToken);
      } else {
        cb();
      }
    });
  }

  function fetchFBData(fbRestApi, params, cb) {
    // TODO get this to work with response.cursors
    if(_(params).isFunction()) {
      cb = params;
      params = {};
    }

    var limit = params && params.limit;

    FB.api(fbRestApi, params, function(response) {
      if (response.error) {
        cb(response.error);
        return;
      }

      if(Array.isArray(response.data)) { // If there a list of responses, FB will have an array called "data"
        var since;
        if(response.paging && response.paging.previous) {
          sinceMatch =  response.paging.previous.match(/since=([^&]*)/);
          since = sinceMatch && sinceMatch[1];
        }

        var numRecords = response.data.length;
        var next = response.paging && response.paging.next;
        if(!limit || ((0 < numRecords && numRecords < limit)) && next) {

          // get more data
          fetchFBData(next, null, function(err, result) {
            if(err) return cb(err);

            var totalData = response.data.concat(result.data);
            cb(null, { data: totalData, since: since });
          });
        } else {
          cb(null, { data: response.data, since: since });
        }
      } else { // If there is no array of "data" then the response must be the data
        cb(null, { data: [ response ] }); // The response is an object that has all of the data needed
      }
    });
  }

  /////////////////////////////////////////////////////////
  // UI Components
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

  var fbAPIs = [ // Scraped from FB's website
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
    var fbError = {
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
        pageId: '/me', edgeApi: '', maxObjectCount: 5000,
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
                ButtonInput.element({ onClick: this.generateSchema, value: 'Generate the Schema', disabled: !this.canGenerateSchema() }),
                ButtonInput.element({ onClick: this.submit, value: 'Submit Data', disabled: !this.canSubmit() })
              ),
              FieldGroup.element({ onFieldUpdate: this.onSchemaChange, value: this.state.schema })
            )
          )
        )
      );
    },

    // Non-react methods
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
      var password = this.props.authentication.password;
      fetchFBData(api, { access_token: password, limit: this.state.sampleSize }, function(err, result) {
        if(err) {
          _this.setState({ sampleData: [], sampleDataString: '[]', errorMessage: buildError(api, err) });
        } else {
          _this.setState({ sampleData: result.data, sampleDataString: JSON.stringify(result.data, null, 2), errorMessage: '' });
        }
      });
    },
    canGenerateSchema: function() {
      return this.state.sampleData.length > 0;
    },
    generateSchema: function() {
      if(!this.canGenerateSchema()) return;

      var schema = WDCSchema.generateSchema(this.state.sampleData, this.state.sampleSize);
      this.onSchemaChange(schema);
    },
    onSchemaChange: function(schema) {
      this.setState({ schema: schema });
    },
    canSubmit: function() {
      return this.state.schema.length > 0;
    },
    submit: function() {
      if(!this.canSubmit()) return;

      //TODO: Set values on tableau.connectionData
      var connectionData = {
        fbApi: this.getFBApi(),
        maxObjectCount: this.state.maxObjectCount
      };

      if(this.props.onSubmit) {
        this.props.onSubmit(this.state.schema, connectionData);
      }
    }
  });
  FacebookWDCApp.element = React.createFactory(FacebookWDCApp);

  var FacebookLogin = React.createClass({
    getInitialState: function () {
      return { clientId: DEFAULT_CLIENT_ID, version: DEFAULT_FB_VERSION, scope: DEFAULT_REQUESTED_SCOPE.split(',').join(', ') };
    },
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
        Panel.element(null,
          warning,
          Input.element({ type: 'text', value: this.state.clientId, onChange: this.onClientIdChange, label: 'Client ID' }),
          Input.element({ type: 'text', value: this.state.version, onChange: this.onVersionChange, label: 'API Version' }),
          Input.element({ type: 'textarea', value: this.state.scope, onChange: this.onScopeChange, label: 'Scope' }),
          ButtonInput.element({ onClick: this.onClick, value: 'Login' })
        )
      );
    },

    // Non-react methods
    onClick: function() {
      var _this = this;

      getAccessToken(this.state.clientId, this.state.version, function(accessToken) {
        if(accessToken) {
          _this.props.onAccessToken(accessToken);
        } else {
          authenticate(_this.state.clientId, _this.state.version, _this.state.scope);
        }
      });
    },
    onClientIdChange: function(e) {
      this.setState({ clientId: e.target.value });
    },
    onVersionChange: function(e) {
      this.setState({ version: e.target.value });
    },
    onScopeChange: function(e) {
      this.setState({ scope: e.target.value.split(/\s,\s/).join(',') });
    }
  });
  FacebookLogin.element = React.createFactory(FacebookLogin);


  //////////////////////////////////////////////////////////////
  // Connect the UI to tableau
  //////////////////////////////////////////////////////////////

  // Helper method that sets up the react class as an element at the root of this app.
  function renderElement(clazz, props) {
    React.render(React.createElement(clazz, props), document.getElementById('appRoot'));
  }

  // Check to see if client ID was passed in
  var urlState = null;
  var stateMatch = window.location.search.match(/state=([^&/]*)/);
  if(stateMatch) {
    var urlState = JSON.parse(decodeURIComponent(stateMatch[1]));
  }

  var context = TableauSchema.setup({

    fetchPassword: function(cb) {

      function onAccessToken(accessToken) {
        cb({ password: accessToken });
      }

      $(function() {
        if(urlState) {
          getAccessToken(urlState.clientId, urlState.version, function(accessToken) {
            if(accessToken) {
              onAccessToken(accessToken);
            } else {
              renderElement(FacebookLogin, { onAccessToken: onAccessToken });
            }
          });
        } else {
          renderElement(FacebookLogin, { onAccessToken: onAccessToken });
        }
      });

    },

    fetchSetupData: function(authentication, cb) {

      $(function() {
        renderElement(FacebookWDCApp, { authentication: authentication, onSubmit: cb });
      });

    },

    fetchData: function(authentication, lastRecordToken, metaData, cb) {

      if(!authentication.password) {
        throw new Error('Missing password when fetching data')
      }

      var params = { access_token: authentication.password };
      if(_.isFinite(parseInt(metaData.maxObjectCount))) params.limit = metaData.maxObjectCount;
      if(lastRecordToken) params.limit = lastRecordToken;

      fetchFBData(metaData.fbApi, params, function(err, result) {
        if(err) {
          throw new Error(buildError(metaData.fbApi, err));
        }

        var lastRecordToken = result.since;

        cb(result.data, lastRecordToken, false);
      });

    }
  });

  context.setConnectionName('Facebook');

})(window, jQuery, _, React, ReactBootstrap, TableauSchema, WDCSchema, WDCSchemaUI);