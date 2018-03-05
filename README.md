## Getting Started

*Prerequisites: Node 8+, `bower`, and `polymer-cli`*

 1. Install dependencies with:

    ```shell
    bower install
    npm install
    ```

 2. Run the following command to start serving the app:

        npm start

 3. Open browser at http://localhost:8081.


## NPM Scripts

Run any of the following npm scripts with `npm run <command>` or `yarn <command>`.

    build       Builds the project
    serve       Starts app and mock-API servers for local development
    lint        Lints files in the project

### `build`
Builds the project, creating `debug` and `production` versions in the build output (under the `build/` directory). The `debug` version contains the original unoptimized source, while `production` has a fully optimized and bundled version (via `polymer-cli`).

### `serve`
Starts an app server, which serves the application files; and an API server that the app proxies data requests to. The API server responds with mock JSON data, which is useful for local development.

By default, the app server serves the original source files as-is. To serve the build output, append `-- /path/to/build/output`. The following example builds the project and serves the `production` output:

    npm run build
    npm run serve -- build/production

### `lint`
Lints all `*.js` and `*.html` files in the project under the `app/` source directory. Note that `polymer-lint` currently does not handle ES2017 syntax (including `async`/`await`), so some false-positive warnings/errors may be seen in the linter output.
