import typescript from "rollup-plugin-typescript2";
import { terser } from "rollup-plugin-terser";
import { nodeResolve } from '@rollup/plugin-node-resolve';

var dev = true;

export default {
    input: ["src/hue-like-light-card.ts"],
    output: {
        dir: "./dist",
        format: "es",
    },
    plugins: [
        typescript(),
        nodeResolve(),
        !dev && terser()
    ]
}