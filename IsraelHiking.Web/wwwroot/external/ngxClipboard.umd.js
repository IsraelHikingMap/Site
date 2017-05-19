(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('@angular/core'), require('@angular/platform-browser'), require('ngx-window-token'), require('@angular/common')) :
	typeof define === 'function' && define.amd ? define(['exports', '@angular/core', '@angular/platform-browser', 'ngx-window-token', '@angular/common'], factory) :
	(factory((global.ngx = global.ngx || {}, global.ngx.clipboard = global.ngx.clipboard || {}),global.ng.core,global._angular_platformBrowser,global.ngxWindowToken,global.ng.common));
}(this, (function (exports,_angular_core,_angular_platformBrowser,ngxWindowToken,_angular_common) { 'use strict';

var ClipboardService = (function () {
    /**
     * @param {?} document
     * @param {?} window
     */
    function ClipboardService(document, window) {
        this.document = document;
        this.window = window;
    }
    Object.defineProperty(ClipboardService.prototype, "isSupported", {
        /**
         * @return {?}
         */
        get: function () {
            return !!this.document.queryCommandSupported && !!this.document.queryCommandSupported('copy');
        },
        enumerable: true,
        configurable: true
    });
    /**
     * @param {?} element
     * @return {?}
     */
    ClipboardService.prototype.isTargetValid = function (element) {
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
            if (element.hasAttribute('disabled')) {
                // tslint:disable-next-line:max-line-length
                throw new Error('Invalid "target" attribute. Please use "readonly" instead of "disabled" attribute');
            }
            return true;
        }
        throw new Error('Target should be input or textarea');
    };
    /**
     * copyFromInputElement
     * @param {?} targetElm
     * @param {?} renderer
     * @return {?}
     */
    ClipboardService.prototype.copyFromInputElement = function (targetElm, renderer) {
        try {
            this.selectTarget(targetElm, renderer);
            var /** @type {?} */ re = this.copyText();
            this.clearSelection(targetElm, this.window);
            return re;
        }
        catch (error) {
            return false;
        }
    };
    /**
     * Creates a fake textarea element, sets its value from `text` property,
     * and makes a selection on it.
     * @param {?} content
     * @param {?} renderer
     * @return {?}
     */
    ClipboardService.prototype.copyFromContent = function (content, renderer) {
        if (!this.tempTextArea) {
            this.tempTextArea = this.createTempTextArea(this.document, this.window);
            this.document.body.appendChild(this.tempTextArea);
        }
        this.tempTextArea.value = content;
        return this.copyFromInputElement(this.tempTextArea, renderer);
    };
    /**
     * @return {?}
     */
    ClipboardService.prototype.destroy = function () {
        if (this.tempTextArea) {
            this.document.body.removeChild(this.tempTextArea);
            this.tempTextArea = undefined;
        }
    };
    /**
     * @param {?} inputElement
     * @param {?} renderer
     * @return {?}
     */
    ClipboardService.prototype.selectTarget = function (inputElement, renderer) {
        renderer.invokeElementMethod(inputElement, 'select');
        renderer.invokeElementMethod(inputElement, 'setSelectionRange', [0, inputElement.value.length]);
        return inputElement.value.length;
    };
    /**
     * @return {?}
     */
    ClipboardService.prototype.copyText = function () {
        return this.document.execCommand('copy');
    };
    /**
     * @param {?} inputElement
     * @param {?} window
     * @return {?}
     */
    ClipboardService.prototype.clearSelection = function (inputElement, window) {
        // tslint:disable-next-line:no-unused-expression
        inputElement && inputElement.blur();
        window.getSelection().removeAllRanges();
    };
    /**
     * @param {?} doc
     * @param {?} window
     * @return {?}
     */
    ClipboardService.prototype.createTempTextArea = function (doc, window) {
        var /** @type {?} */ isRTL = doc.documentElement.getAttribute('dir') === 'rtl';
        var /** @type {?} */ ta;
        ta = doc.createElement('textarea');
        // Prevent zooming on iOS
        ta.style.fontSize = '12pt';
        // Reset box model
        ta.style.border = '0';
        ta.style.padding = '0';
        ta.style.margin = '0';
        // Move element out of screen horizontally
        ta.style.position = 'absolute';
        ta.style[isRTL ? 'right' : 'left'] = '-9999px';
        // Move element to the same position vertically
        var /** @type {?} */ yPosition = window.pageYOffset || doc.documentElement.scrollTop;
        ta.style.top = yPosition + 'px';
        ta.setAttribute('readonly', '');
        return ta;
    };
    return ClipboardService;
}());
ClipboardService.decorators = [
    { type: _angular_core.Injectable },
];
/**
 * @nocollapse
 */
ClipboardService.ctorParameters = function () { return [
    { type: undefined, decorators: [{ type: _angular_core.Inject, args: [_angular_platformBrowser.DOCUMENT,] },] },
    { type: undefined, decorators: [{ type: _angular_core.Inject, args: [ngxWindowToken.WINDOW,] },] },
]; };
/**
 * @param {?} doc
 * @param {?} win
 * @param {?} parentDispatcher
 * @return {?}
 */
function CLIPBOARD_SERVICE_PROVIDER_FACTORY(doc, win, parentDispatcher) {
    return parentDispatcher || new ClipboardService(doc, win);
}

var CLIPBOARD_SERVICE_PROVIDER = {
    provide: ClipboardService,
    deps: [_angular_platformBrowser.DOCUMENT, ngxWindowToken.WINDOW, [new _angular_core.Optional(), new _angular_core.SkipSelf(), ClipboardService]],
    useFactory: CLIPBOARD_SERVICE_PROVIDER_FACTORY
};

var ClipboardDirective = (function () {
    /**
     * @param {?} clipboardSrv
     * @param {?} renderer
     */
    function ClipboardDirective(clipboardSrv, renderer) {
        this.clipboardSrv = clipboardSrv;
        this.renderer = renderer;
        this.cbOnSuccess = new _angular_core.EventEmitter();
        this.cbOnError = new _angular_core.EventEmitter();
    }
    /**
     * @return {?}
     */
    ClipboardDirective.prototype.ngOnInit = function () { };
    /**
     * @return {?}
     */
    ClipboardDirective.prototype.ngOnDestroy = function () {
        this.clipboardSrv.destroy();
    };
    /**
     * @param {?} button
     * @return {?}
     */
    ClipboardDirective.prototype.onClick = function (button) {
        if (!this.clipboardSrv.isSupported) {
            this.handleResult(false, undefined);
        }
        else if (this.targetElm && this.clipboardSrv.isTargetValid(this.targetElm)) {
            this.handleResult(this.clipboardSrv.copyFromInputElement(this.targetElm, this.renderer), this.targetElm.value);
        }
        else if (this.cbContent) {
            this.handleResult(this.clipboardSrv.copyFromContent(this.cbContent, this.renderer), this.cbContent);
        }
    };
    /**
     * Fires an event based on the copy operation result.
     * @param {?} succeeded
     * @param {?} copiedContent
     * @return {?}
     */
    ClipboardDirective.prototype.handleResult = function (succeeded, copiedContent) {
        if (succeeded) {
            this.cbOnSuccess.emit({ isSuccess: true, content: copiedContent });
        }
        else {
            this.cbOnError.emit({ isSuccess: false });
        }
    };
    return ClipboardDirective;
}());
ClipboardDirective.decorators = [
    { type: _angular_core.Directive, args: [{
                selector: '[ngxClipboard]'
            },] },
];
/**
 * @nocollapse
 */
ClipboardDirective.ctorParameters = function () { return [
    { type: ClipboardService, },
    { type: _angular_core.Renderer, },
]; };
ClipboardDirective.propDecorators = {
    'targetElm': [{ type: _angular_core.Input, args: ['ngxClipboard',] },],
    'cbContent': [{ type: _angular_core.Input },],
    'cbOnSuccess': [{ type: _angular_core.Output },],
    'cbOnError': [{ type: _angular_core.Output },],
    'onClick': [{ type: _angular_core.HostListener, args: ['click', ['$event.target'],] },],
};

var ClipboardModule = (function () {
    function ClipboardModule() {
    }
    return ClipboardModule;
}());
ClipboardModule.decorators = [
    { type: _angular_core.NgModule, args: [{
                imports: [_angular_common.CommonModule, ngxWindowToken.WindowTokenModule],
                // tslint:disable-next-line:object-literal-sort-keys
                declarations: [ClipboardDirective],
                exports: [ClipboardDirective],
                providers: [CLIPBOARD_SERVICE_PROVIDER]
            },] },
];
/**
 * @nocollapse
 */
ClipboardModule.ctorParameters = function () { return []; };

exports.ClipboardModule = ClipboardModule;
exports.ClipboardDirective = ClipboardDirective;

Object.defineProperty(exports, '__esModule', { value: true });

})));
