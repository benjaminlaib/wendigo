import * as utils from '../../utils/utils';
import * as elementsAssertionUtils from './assert_elements';
import * as assertUtils from '../../utils/assert_utils';

import RequestAssertionsFilter from '../requests/request_assertions_filter';
import RequestFilter from '../requests/request_filter';

import WendigoModule from '../wendigo_module';
import { QueryError, FatalError, WendigoError } from '../../errors';
import { WendigoSelector } from '../../types';

export default class BrowserAssertions extends WendigoModule {

    public get requests(): RequestAssertionsFilter { // TODO: make a proper plugin
        const b = this._browser as any;
        const requests = b.requests.filter as RequestFilter;
        return new RequestAssertionsFilter((r) => {
            r();
        }, requests);
    }

    public async exists(selector: WendigoSelector, msg?: string): Promise<void> {
        if (!msg) msg = `Expected element "${selector}" to exists`;
        let element;
        try {
            element = await this._browser.query(selector);
        } catch (err) {
            throw WendigoError.overrideFnName(err, "assert.exists");
        }
        if (!element) return assertUtils.rejectAssertion("assert.exists", msg);
    }

    public visible(selector: WendigoSelector, msg?: string): Promise<void> {
        return this._browser.evaluate((q) => {
            const elements = WendigoUtils.queryAll(q);
            if (elements.length === 0) throw new WendigoError("assert.visible", "Element not Found");
            for (const e of elements) {
                if (WendigoUtils.isVisible(e)) return true;
            }
            return false;
        }, selector).catch(() => {
            return assertUtils.rejectAssertion("assert.visible", `Selector "${selector}" doesn't match any elements.`);
        }).then((visible: boolean) => {
            if (!visible) {
                if (!msg) msg = `Expected element "${selector}" to be visible.`;
                return assertUtils.rejectAssertion("assert.visible", msg);
            } else return Promise.resolve();
        });
    }

    public async tag(selector: WendigoSelector, expected: string, msg?: string): Promise<void> {
        if (!expected) {
            return Promise.reject(new WendigoError("assert.tag", `Missing expected tag for assertion.`));
        }
        const tagsFound = await this._browser.evaluate((q) => {
            const elements = WendigoUtils.queryAll(q);
            const results = [];
            for (const e of elements) {
                results.push(e.tagName.toLowerCase());
            }
            return results;
        }, selector);
        for (const tag of tagsFound) {
            if (tag === expected) return Promise.resolve();
        }
        if (!msg) {
            msg = `No element with tag "${expected}" found.`;
        }
        return assertUtils.rejectAssertion("assert.tag", msg);
    }

    public text(selector: WendigoSelector, expected: string | RegExp | Array<string | RegExp>, msg?: string): Promise<void> {
        if ((!expected && expected !== "") || (Array.isArray(expected) && expected.length === 0)) {
            return Promise.reject(new WendigoError("assert.text", `Missing expected text for assertion.`));
        }
        const processedExpected = utils.arrayfy(expected);
        return this._browser.text(selector).then((texts) => {
            for (const expectedText of processedExpected) {
                if (!utils.matchTextList(texts, expectedText)) {
                    if (!msg) {
                        const foundText = texts.length === 0 ? "no text" : `"${texts.join(" ")}"`;
                        msg = `Expected element "${selector}" to have text "${expectedText}", ${foundText} found.`;
                    }
                    return assertUtils.rejectAssertion("assert.text", msg);
                }
            }
            return Promise.resolve();
        });
    }

    public textContains(selector: WendigoSelector, expected: string, msg?: string): Promise<void> {
        return this._browser.text(selector).then((texts) => {
            for (const text of texts) {
                if (text && text.includes(expected)) return Promise.resolve();
            }
            if (!msg) {
                const foundText = texts.length === 0 ? "no text" : `"${texts.join(" ")}"`;
                msg = `Expected element "${selector}" to contain text "${expected}", ${foundText} found.`;
            }
            return assertUtils.rejectAssertion("assert.textContains", msg);
        });
    }

    public title(expected: string | RegExp, msg?: string): Promise<void> {
        return this._browser.title().then((title) => {
            const foundTitle = title ? `"${title}"` : "no title";
            if (!utils.matchText(title, expected)) {
                if (!msg) msg = `Expected page title to be "${expected}", ${foundTitle} found.`;
                return assertUtils.rejectAssertion("assert.title", msg);
            }
            return Promise.resolve();
        });
    }

    public async class(selector: WendigoSelector, expected: string, msg?: string): Promise<void> {
        let classes;
        try {
            classes = await this._browser.class(selector);
        } catch (err) {
            return Promise.reject(new QueryError("assert.class", `Selector "${selector}" doesn't match any elements.`));
        }
        if (!classes.includes(expected)) {
            if (!msg) {
                const foundClasses = classes.length === 0 ? "no classes" : `"${classes.join(" ")}"`;
                msg = `Expected element "${selector}" to contain class "${expected}", ${foundClasses} found.`;
            }
            return assertUtils.rejectAssertion("assert.class", msg);
        }
    }

    public async url(expected: string | RegExp, msg?: string): Promise<void> {
        let url;
        try {
            url = await this._browser.url();
        } catch (err) {
            throw new FatalError("assert.url", `Can't obtain page url.${err.extraMessage || err.message}`);
        }
        if (!utils.matchText(url, expected)) {
            if (!msg) msg = `Expected url to be "${utils.stringify(expected)}", "${url}" found`;
            return assertUtils.rejectAssertion("assert.url", msg, url, expected);
        }
    }

    public value(selector: WendigoSelector, expected: string | null, msg?: string): Promise<void> {
        return this._browser.value(selector).then((value) => {
            if (value !== expected) {
                if (!msg) {
                    if (value === null) msg = `Expected element "${selector}" to have value "${expected}", no value found`;
                    else msg = `Expected element "${selector}" to have value "${expected}", "${value}" found`;
                }
                return assertUtils.rejectAssertion("assert.value", msg, value, expected);
            }
            return Promise.resolve();
        });
    }

    public element(selector: WendigoSelector, msg?: string): Promise<void> {
        return this.elements(selector, 1, msg).catch((err: Error) => {
            return Promise.reject(WendigoError.overrideFnName(err, "assert.element"));
        });
    }

    public elements(selector: WendigoSelector, count: number, msg?: string): Promise<void> {
        const assertCountData = elementsAssertionUtils.parseCountInput(count);
        const countCase = elementsAssertionUtils.getCountCase(assertCountData);
        if (!countCase) {
            return Promise.reject(new WendigoError("assert.elements", `parameter count (${count}) is not valid.`));
        }
        return this._browser.queryAll(selector).then((elements) => {
            const elementsCount = elements.length;
            return elementsAssertionUtils.makeAssertion(selector, assertCountData, countCase, elementsCount, msg);
        });
    }

    /* eslint-disable complexity */
    public async attribute(selector: WendigoSelector, attribute: string, expectedValue?: string | null, msg?: string): Promise<void> {
        const customMessage = Boolean(msg);
        if (!customMessage) {
            msg = `Expected element "${selector}" to have attribute "${attribute}"`;
            if (expectedValue) msg = `${msg} with value "${expectedValue}"`;
            if (expectedValue === null) msg = `Expected element "${selector}" not to have attribute "${attribute}"`;
        }

        const attributes: Array<string | null> = await this._browser.evaluate((q, attrName) => {
            const elements = WendigoUtils.queryAll(q);
            return Array.from(elements).map((el) => {
                return el.getAttribute(attrName);
            });
        }, selector, attribute);

        if (attributes.length === 0) {
            if (!customMessage) msg = `${msg}, no element found.`;
            return assertUtils.rejectAssertion("assert.attribute", msg as string);
        }

        const filteredAttributes = attributes.filter(a => a !== null);
        if (expectedValue === null) {
            if (filteredAttributes.length === 0) return Promise.resolve();
        } else {
            for (const attr of filteredAttributes) {
                if (expectedValue === undefined || utils.matchText(attr, expectedValue)) {
                    return Promise.resolve();
                }
            }
        }

        if (!customMessage) {
            const foundElements = new Set(attributes.filter((a) => {
                return a !== null;
            }));
            if (foundElements.size === 0 || expectedValue === null) msg = `${msg}.`;
            else {
                const foundArr = Array.from(foundElements);
                msg = `${msg}, ["${foundArr.join('", "')}"] found.`;
            }
        }
        return assertUtils.rejectAssertion("assert.attribute", msg as string);
    }
    /* eslint-enable complexity */

    public style(selector: WendigoSelector, style: string, expected: string, msg?: string): Promise<void> {
        return this._browser.evaluate((sel, sty) => {
            const element = WendigoUtils.queryElement(sel);
            if (!element) return Promise.reject();
            const styles = getComputedStyle(element);
            return styles.getPropertyValue(sty);
        }, selector, style).catch(() => {
            const error = new QueryError("assert.style", `Element "${selector}" not found.`);
            return Promise.reject(error);
        }).then((value) => {
            if (value !== expected) {
                if (!msg) {
                    msg = `Expected element "${selector}" to have style "${style}" with value "${expected}"`;
                    if (value) msg = `${msg}, "${value}" found.`;
                    else msg = `${msg}, style not found.`;
                }
                return assertUtils.rejectAssertion("assert.style", msg);
            }
            return Promise.resolve();
        });
    }

    public href(selector: WendigoSelector, expected: string, msg?: string): Promise<void> {
        return this.attribute(selector, "href", expected, msg).catch((err: Error) => {
            return Promise.reject(WendigoError.overrideFnName(err, "assert.href"));
        });
    }

    public innerHtml(selector: WendigoSelector, expected: string | RegExp, msg?: string): Promise<void> {
        if (!expected && expected !== "") return Promise.reject(new WendigoError("assert.innerHtml", "Missing expected html for assertion."));

        return this._browser.innerHtml(selector).then((found) => {
            if (found.length === 0) {
                const error = new QueryError("assert.innerHtml", `Element "${selector}" not found.`);
                return Promise.reject(error);
            }
            for (const html of found) {
                if (utils.matchText(html, expected)) return Promise.resolve();
            }

            if (!msg) {
                msg = `Expected element "${selector}" to have inner html "${expected}", "${found.join(" ")}" found.`;
            }

            return assertUtils.rejectAssertion("assert.innerHtml", msg, found, expected);
        });
    }

    public options(selector: WendigoSelector, expected: string | Array<string>, msg?: string): Promise<void> {
        const parsedExpected = utils.arrayfy(expected);
        return this._browser.options(selector).then((options) => {
            const sameMembers = assertUtils.sameMembers(parsedExpected, options);
            if (!sameMembers) {
                if (!msg) {
                    const expectedText = parsedExpected.join(", ");
                    const optionsText = options.join(", ");
                    msg = `Expected element "${selector}" to have options "${expectedText}", "${optionsText}" found.`;
                }
                return assertUtils.rejectAssertion("assert.options", msg, options, expected);
            }
            return Promise.resolve();
        });
    }

    public selectedOptions(selector: WendigoSelector, expected: string | Array<string>, msg?: string): Promise<void> {
        const parsedExpected = utils.arrayfy(expected);
        return this._browser.selectedOptions(selector).then((selectedOptions) => {
            const sameMembers = assertUtils.sameMembers(parsedExpected, selectedOptions);
            if (!sameMembers) {
                if (!msg) {
                    const expectedText = parsedExpected.join(", ");
                    const optionsText = selectedOptions.join(", ");
                    msg = `Expected element "${selector}" to have options "${expectedText}" selected, "${optionsText}" found.`;
                }
                return assertUtils.rejectAssertion("assert.selectedOptions", msg, selectedOptions, expected);
            }
            return Promise.resolve();
        });
    }

    public global(key: string, expected?: any, msg?: string): Promise<void> {
        return this._browser.evaluate((k: string) => {
            return (window as any)[k];
        }, key).then((value) => {
            if (expected === undefined) {
                if (value === undefined) {
                    if (!msg) {
                        msg = `Expected "${key}" to be defined as global variable.`;
                    }
                    return assertUtils.rejectAssertion("assert.global", msg);
                }
            } else if (value !== expected) {
                if (!msg) {
                    msg = `Expected "${key}" to be defined as global variable with value "${expected}", "${value}" found.`;
                }
                return assertUtils.rejectAssertion("assert.global", msg, value, expected);
            }
            return Promise.resolve();
        });
    }

    public async checked(selector: WendigoSelector, msg?: string): Promise<void> {
        let value;
        try {
            value = await this._browser.checked(selector);
        } catch (err) {
            throw new QueryError("assert.checked", `Element "${selector}" not found.`);
        }
        if (value !== true) {
            if (!msg) msg = `Expected element "${selector}" to be checked.`;
            return assertUtils.rejectAssertion("assert.checked", msg, value, true);
        }
    }

    public async disabled(selector: WendigoSelector, msg?: string): Promise<void> {
        let value;
        try {
            value = await this._browser.attribute(selector, "disabled");
        } catch (err) {
            throw new QueryError("assert.disabled", `Element "${selector}" not found.`);
        }
        if (value === null) {
            if (!msg) msg = `Expected element "${selector}" to be disabled.`;
            return assertUtils.rejectAssertion("assert.disabled", msg);
        }
    }

    public async enabled(selector: WendigoSelector, msg?: string): Promise<void> {
        let value;
        try {
            value = await this._browser.attribute(selector, "disabled");
        } catch (err) {
            throw new QueryError("assert.enabled", `Element "${selector}" not found.`);
        }
        if (value !== null) {
            if (!msg) msg = `Expected element "${selector}" to be enabled.`;
            return assertUtils.rejectAssertion("assert.enabled", msg);
        }
    }

    public focus(selector: WendigoSelector, msg?: string): Promise<void> {
        return this._browser.evaluate((q) => {
            const elements = WendigoUtils.queryAll(q);
            if (elements.length === 0) return Promise.reject();
            for (const el of elements) {
                if (document.activeElement === el) return true;
            }
            return false;
        }, selector).catch(() => {
            const error = new QueryError("assert.focus", `Element "${selector}" not found.`);
            return Promise.reject(error);
        }).then((focused) => {
            if (!focused) {
                if (!msg) msg = `Expected element "${selector}" to be focused.`;
                return assertUtils.rejectAssertion("assert.focus", msg);
            }
            return Promise.resolve();
        });
    }

    public redirect(msg?: string): Promise<void> {
        if (!msg) msg = `Expected current url to be a redirection.`;

        if (!this._browser.initialResponse) assertUtils.rejectAssertion("assert.redirect", msg);
        else {
            const chain = this._browser.initialResponse.request().redirectChain();
            if (chain.length === 0) {
                return assertUtils.rejectAssertion("assert.redirect", msg);
            }
        }
        return Promise.resolve();
    }
}
