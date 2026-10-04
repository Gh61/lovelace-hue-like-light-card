import typescript from 'rollup-plugin-typescript2';
import terser from '@rollup/plugin-terser';
import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import serve from 'rollup-plugin-serve';

const LCERROR = '\x1b[31m%s\x1b[0m'; //red

var dev = true;

// build-time constants of the Home Assistant frontend (its DefinePlugin), used by the copied HA source in src/ha
const haDefines = {
    __STATIC_PATH__: JSON.stringify('/static/')
};

const serverOptions = {
    contentBase: ['./dist'],
    host: '127.0.0.1',
    port: 5500,
    allowCrossOrigin: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  };

export default cli => {
    var runServer = cli.runServer || false;

    return {
        onwarn: function(warning) {
            // Skip certain warnings
        
            // formatjs is checking 'this' and it throws this warning
            if (warning.code === 'THIS_IS_UNDEFINED' &&
                (
                    warning.id.endsWith('node_modules\\@formatjs\\intl-utils\\lib\\src\\resolve-locale.js') ||
                    warning.id.endsWith('node_modules\\@formatjs\\intl-utils\\lib\\src\\diff.js')
                )
            ) {
                //console.log(warning);
                return;
            }

            // culori known circular dependency
            if (warning.code === 'CIRCULAR_DEPENDENCY' &&
                warning.message.includes('culori')) {
                return;
            }

            // console.warn everything else
            if (warning.loc) {
                console.warn(LCERROR, `${warning.loc.file} (${warning.loc.line}:${warning.loc.column})\r\n${warning.message}`);
                if (warning.frame)
                    console.warn(warning.frame);
            } else {
                console.warn(LCERROR, warning.message);
            }
        },
        input: ["src/hue-like-light-card.ts"],
        output: {
            dir: dev ? "./dist" : "./release",
            format: "es",
        },
        plugins: [
            replace({ preventAssignment: true, values: haDefines }),
            json({compact:true}),
            typescript(),
            nodeResolve(),
            runServer && serve(serverOptions),
            !dev && terser()
        ]
    }
}