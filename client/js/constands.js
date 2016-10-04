(function () {
    var AUTH_EVENTS = 'auth-not-authenticated';
    var API_ENDPOINT = 'http://localhost:8080/api';
    Object.freeze(AUTH_EVENTS);
    Object.freeze(API_ENDPOINT);

    function getConstant(num) {
        if (num === 1) {
            return AUTH_EVENTS;
        } else if (num === 2) {
            return API_ENDPOINT;
        } else {
            return "Constant not Found";
        }
    }

    return {
        getConstant: getConstant
    };
}());
