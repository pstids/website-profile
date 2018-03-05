## Using `polymer-cli` (only if needed)
**The current NPM scripts are recommended**, but it's possible to run the equivalent commands with `polymer-cli` (e.g., for testing or customizing sub-commands within the NPM script).

#### Commands for `npm run build`

    polymer build
    mv build/debug/app build/debug/powercenter
    mv build/production/app build/production/powercenter

#### Commands for `npm run lint`

    jshint --reporter=node_modules/jshint-stylish **/*.js
    polymer lint --input app/elements/**/*.html

#### Commands for `npm run serve` (excluding API server)

    polymer serve --proxy-path b --proxy-target <API_SERVER_URL> /path/to/build/output

**Example:** *redirect API requests from `http://localhost/b` to `http://localhost:8888`, and serve the production build output*

    # 1. Start API server ...

    # 2. Start app server
    polymer serve --proxy-path b --proxy-target http://localhost:8888 build/production

    # 3. Open http://localhost:8081/powercenter (or port specified in command output)

## Recommendations

### Code

 * _**Use templates**_. Dynamically generating DOM is inefficient, and requires class-patching to workaround ShadyDOM/CSS bugs. Templates would help shrink your code and improve maintainability.

### Tooling

 * _**Switch to `webpack`**_. `polymer-cli` is buggy (especially its `polymer build` command). See [`polymer-webpack-loader`](https://github.com/webpack-contrib/polymer-webpack-loader) and [Rob Dodson's article](http://robdodson.me/how-to-use-polymer-with-webpack/) on usage.

### App Performance

 * _**Use PRPL patern**_. Currently, *all* custom elements are loaded at startup, which dramatically slows down *time to first paint*. The [PRPL pattern](https://developers.google.com/web/fundamentals/performance/prpl-pattern/) (especially an app shell and lazily loading elements) would improve load performance, allowing for a much faster startup.
