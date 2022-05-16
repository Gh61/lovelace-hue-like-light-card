import typescript from "rollup-plugin-typescript2";
import { terser } from "rollup-plugin-terser";

export default {
    input: ["src/hue-like-light-card.ts"],
    output: {
        dir: "./dist",
        format: "es",
    },
    plugins: [
        typescript(),
        terser()
    ]
}