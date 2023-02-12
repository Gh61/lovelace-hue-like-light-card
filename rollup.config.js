import typescript from "rollup-plugin-typescript2";
import { terser } from "rollup-plugin-terser";
import { nodeResolve } from '@rollup/plugin-node-resolve';
const LCERROR = '\x1b[31m%s\x1b[0m'; //red

var dev = true;

export default {
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
        typescript(),
        nodeResolve(),
        !dev && terser()
    ]
}