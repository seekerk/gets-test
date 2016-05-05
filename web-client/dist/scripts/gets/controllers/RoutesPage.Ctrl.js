function RoutesPage(document, window) {
    this.document = document;
    this.window = window;

    // Models
    this._socials = null;
    this._points = null;
    this._categories = null;
    this._user = null;
    this._utils = null;
    this._routes = null;
    this._mapCtrl = null;

    // Views
    this._socialsMain = null;
    this._headerView = null;
    this._socialInfo = null;
    this._routeInfo = null;

    this.currentView = null;
}

// Forms
RoutesPage.MAIN = 'main';
RoutesPage.SOCIAL_INFO = 'social_info';
RoutesPage.ROUTE_INFO = 'route_info';

RoutesPage.prototype.changeForm = function () {
    var form = this._utils.getHashVar('form');
    Logger.debug('changeForm form = ' + form);
    if (form === RoutesPage.MAIN) {
        this.showRoutesMain();
    } else if (form === RoutesPage.SOCIAL_INFO) {
        this.showSocialInfo();
    } else if (form === RoutesPage.ROUTE_INFO) {
        this.showRouteInfo();
    } else if (typeof form === 'undefined') {
        this.window.location.replace('#form=' + RoutesPage.MAIN);
    }
};

RoutesPage.prototype.initPage = function () {
    var self = this;

    //TODO: почистить говно
    // try {

    if(this._routes == null)
    {
        this._routes = [];
    }
    // Init map
    if (this._mapCtrl == null) {
        this._mapCtrl = new MapController(this.document, this.window);
        this._mapCtrl.initMap();
    }

    // Init models
    if (!this._points) {
        this._points = new PointsClass();
    }
    if (!this._categories) {
        this._categories = new CategoriesClass();
    }
    if (!this._socials) {
        this._socials = new SocialsClass();
    }
    if (!this._user) {
        this._user = new UserClass(this.window);
        this._user.fetchAuthorizationStatus();
        Logger.debug('is Auth: ' + this._user.isLoggedIn());
    }
    if (!this._utils) {
        this._utils = new UtilsClass(this.window);
    }

    // Init views
    // TODO: наклепать верстку и установить кошерные айдишники, сделать классы вьюшек
    if (!this._socialsMain) {
        this._socialsMain = new SocialsMain(this.document, $(this.document).find('#socials-main-page'));
    }
    if (!this._headerView) {
        this._headerView = new HeaderView(this.document, $(this.document).find('.navbar'));
    }

    // TODO: набросать формы инфо
/*    if (!this._socialInfo) {
        this._socialInfo = new SocialInfo(this.document, $(this.document).find('#social-info-page'));
    }*/
    if (!this._routeInfo) {
        this._routeInfo = new RouteInfo(this.document, $(this.document).find('#route-info-page'));
    }

    //Init first page
    this.currentView = this._socialsMain;
    this.changeForm();

    // Init Socials main
    this._socialsMain.toggleOverlay();
    this._socialsMain.setLatitude(this._mapCtrl.getMapCenter().lat);
    this._socialsMain.setLongitude(this._mapCtrl.getMapCenter().lng);


    // Hash change handler
    $(this.window).on('hashchange', function () {
        Logger.debug('hashchanged');
        self.changeForm();
    });

    // Sign in handler
    $(this.document).on('click', '#sign-in-btn', function (e) {
        e.preventDefault();
        self._user.authorizeGoogle();
    });

    // Sign out handler
    $(this.document).on('click', '#sign-out-btn', function (e) {
        e.preventDefault();
        self._user.logout();
    });


    this.downloadSocialsHandler();
    // this.downloadPointsHandler();
    // get user's coordinates
    if (this.window.navigator.geolocation) {
        this.window.navigator.geolocation.getCurrentPosition(function (position) {
            Logger.debug(position);
            self._user.setUserGeoPosition(position);
            self._mapCtrl.setMapCenter(position.coords.latitude, position.coords.longitude);
            self._socialsMain.setLatitude(Math.floor(position.coords.latitude * 10000) / 10000);
            self._socialsMain.setLongitude(Math.floor(position.coords.longitude * 10000) / 10000);

            //self.downloadSocialsHandler();

        }, this.handleGeoLocationError);
    } else {
        Logger.debug('geolocation is not supported by this browser');
    }

    $(this.document).on('click', '.route_to', function (e) {
        e.preventDefault();
        var toCoords = this.name.split(',');
        var fromCoords = self._user.getUsersGeoPosition();
        self.route(fromCoords.lat,fromCoords.lng,toCoords[0],toCoords[1]);
    });
};

RoutesPage.prototype.downloadPointsHandler = function() {
    var that = this;
    try {
        var formData = $(this.document).find('#point-main-form').serializeArray();

        this._points.downLoadPoints(formData, function () {
            var pointList = that._points.getPointList();
            that._mapCtrl.removePointsFromMap();
            that._mapCtrl.placePointsOnMap(pointList, {
                url: '#form=' + PointsPage.POINT_INFO + '&point_uuid=',
                text: $(that._pointInfo.getView()).data('putpoint')
            });
        });
    } catch (Exception) {
        MessageBox.showMessage(Exception.toString(), MessageBox.ERROR_MESSAGE);
        Logger.error(Exception.toString());
    }
};

RoutesPage.prototype.route = function (fromLat,fromLng,toLat,toLng) {
    var that = this;
    var data = {
        'fromLat': fromLat,
        'fromLng': fromLng,
        'toLat': toLat,
        'toLng': toLng
    };
    $.ajax({
        type: 'POST',
        url: GET_ROUTES_ACTION,
        dataType: 'json ',
        data: "routeCoords=" + JSON.stringify(data),
        success: function(response) {
            that._routes = [];
            that._mapCtrl.removeRoutesFromMap();
            $.each(response, function (key, value) {
               var tmpRoute = new RouteClass(value['distance'],value['weight'], value['type'],value['routePoints']);
                that._mapCtrl.placeRouteOnMap(tmpRoute, '#form=' + RoutesPage.ROUTE_INFO + '&route_type=' + value['type']);
                that._routes.push(tmpRoute);
            });
        }
    });
};

RoutesPage.prototype.handleGeoLocationError = function (error) {
    switch (error.code) {
        case error.PERMISSION_DENIED:
            Logger.debug('user denied the request for Geolocation');
            break;
        case error.POSITION_UNAVAILABLE:
            Logger.debug('location information is unavailable');
            break;
        case error.TIMEOUT:
            Logger.debug('the request to get user location timed out');
            break;
        case error.UNKNOWN_ERROR:
            Logger.debug('an unknown error occurred');
            break;
    }
};

RoutesPage.prototype.showRoutesMain = function () {
    try {
        this._headerView.clearOption();

        // this._socialsMain.placeCategoriesInPointMain(this._categories.getCategories());

        this.currentView.hideView();
        this.currentView = this._socialsMain;
        this.currentView.showView();
    } catch (Exception) {
        MessageBox.showMessage(Exception.toString(), MessageBox.ERROR_MESSAGE);
        Logger.error(Exception.toString());
    }
};

RoutesPage.prototype.showSocialInfo = function () {
    try {
        this._headerView.changeOption($(this._socialInfo.getView()).data('pagetitle'), 'glyphicon-chevron-left', '#form=main');

        var pointUUID = decodeURIComponent(this._utils.getHashVar('point_uuid'));
        if (!pointUUID) {
            throw new GetsWebClientException('Track Page Error', 'showSocialInfo, hash parameter point uuid undefined');
        }


        // TODO: найти соц объект в списке
        /*
        this._socials.findPointInPointList(pointUUID);

        Logger.debug(this._points.getPoint());
        this._pointInfo.placePointInPointInfo(this._points.getPoint(), this._user.isLoggedIn());
*/
        this.currentView.hideView();
        this.currentView = this._pointInfo;
        this.currentView.showView();
    } catch (Exception) {
        MessageBox.showMessage(Exception.toString(), MessageBox.ERROR_MESSAGE);
        Logger.error(Exception.toString());
    }
};

RoutesPage.prototype.downloadSocialsHandler = function () {
    var that = this;
    try {
        this._socialsMain.showOverlay();
        // TODO: сюда запихать выбранные в списке категории
        var formData = $(this.document).find('#socials-main-form').serializeArray();

        this._socials.downloadSocials(formData, function () {
            var socialList = that._socials.getSocialList();
            var scopeList = that._socials.getScopeList();
            that._mapCtrl.removeSocialsFromMap();
            that._socialsMain.placeSocialsInSocialList(socialList);
            that._socialsMain.placeScopesInScopeList(scopeList);
            that._mapCtrl.placeSocialsOnMap(socialList);
            that._socialsMain.hideOverlay();
        });
    } catch (Exception) {
        MessageBox.showMessage(Exception.toString(), MessageBox.ERROR_MESSAGE);
        Logger.error(Exception.toString());
    }
};

RoutesPage.prototype.showRouteInfo = function () {
    try {
        this._headerView.changeOption($(this._routeInfo.getView()).data('pagetitle'), 'glyphicon-chevron-left', '#form=main');
        var routeType = decodeURIComponent(this._utils.getHashVar('route_type'));
        this._mapCtrl.setCurrentRouteLayer(routeType);
        this._routeInfo.placeRouteInRouteInfo(this._routes, routeType);
        this.currentView.hideView();
        this.currentView = this._routeInfo;
        this.currentView.showView();
    } catch (Exception) {
        MessageBox.showMessage(Exception.toString(), MessageBox.ERROR_MESSAGE);
        Logger.error(Exception.toString());
    }
};