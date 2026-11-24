// The Hub's theme, with the Hub screens added to the content the classes are read from.
import hub from "./.hub/crates/hub-app/tailwind.config.js";

/** @type {import('tailwindcss').Config} */
export default {
  ...hub,
  content: ["./index.html", "./src/**/*.{ts,tsx}", "./.hub/crates/hub-app/src/**/*.{ts,tsx}"],
};
