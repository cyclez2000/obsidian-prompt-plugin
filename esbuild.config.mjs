import esbuild from "esbuild";

const isProduction = process.argv[2] === "production";

const context = await esbuild.context({
	bundle: true,
	entryPoints: ["main.ts"],
	external: ["obsidian", "electron"],
	format: "cjs",
	target: "es2018",
	logLevel: "info",
	outfile: "main.js",
	sourcemap: isProduction ? false : "inline",
	treeShaking: true,
});

if (isProduction) {
	await context.rebuild();
	await context.dispose();
} else {
	await context.watch();
	console.log("watching for changes...");
}
