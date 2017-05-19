(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('@angular/core')) :
	typeof define === 'function' && define.amd ? define(['exports', '@angular/core'], factory) :
	(factory((global.ngx = global.ngx || {}, global.ngx.clipboard = global.ngx.clipboard || {}),global.ng.core));
}(this, (function (exports,_angular_core) { 'use strict';

var WINDOW = new _angular_core.InjectionToken('WindowToken');
/**
 * @return {?}
 */
function _window() {
    return window;
}
var WindowTokenModule = (function () {
    function WindowTokenModule() {
    }
    return WindowTokenModule;
}());
WindowTokenModule.decorators = [
    { type: _angular_core.NgModule, args: [{
                providers: [{
                        provide: WINDOW,
                        useFactory: _window
                    }]
            },] },
];
/**
 * @nocollapse
 */
WindowTokenModule.ctorParameters = function () { return []; };

exports.WindowTokenModule = WindowTokenModule;
exports.WINDOW = WINDOW;

Object.defineProperty(exports, '__esModule', { value: true });

})));
