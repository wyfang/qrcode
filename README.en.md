# QR Code

Generate, style and decode QR codes in the browser without a database or decoding backend.

[Open online](https://play.wangyifang.com/qrcode/) · [简体中文](./README.md)

## Features

- Generate URL, text and Wi-Fi QR codes; export PNG and SVG files.
- Adjust patterns, finder corners, pixel margins, gradients, opacity and logos.
- Synchronize sliders with numeric fields, including one decimal place and keyboard controls.
- Decode images selected, dropped or pasted into the page, or scan with a camera.
- Save styles in the current browser and use system, light or dark appearance.

## Usage

Requires Node.js 20 or later.

```sh
npm ci
npm run build
npm run dev
```

Open `http://127.0.0.1:4173/`. Build output is written to `dist/` and can be served from a subdirectory. Rebuild after changing source files.

## Notes

Built with React 19, HeroUI v3, Tailwind CSS 4, node-qrcode and jsQR. All visible interactive controls use HeroUI; QR styling renders a standard matrix as SVG.

Margins range from 0 to 100px, defaulting to 24px. Zero adds no hidden border. Parameter sliders range from 0 to 100 in steps of 0.1. The export-size slider maps to pixel dimensions shown in the export panel. Opacity supports numeric input. PNG and SVG preserve transparency; the preview checkerboard is excluded from exported files.

QR content and images are processed in the current page without being uploaded. Styles, including logos and export settings, are saved in the local browser. QR content and Wi-Fi passwords are not written to storage. Clearing site data removes saved styles. If storage is unavailable, the page shows a message and editing and export remain available.

Camera and clipboard features require HTTPS or localhost and are subject to browser permissions. Camera, clipboard and decoding behavior vary by device. Large logos, low contrast and zero margins may reduce recognition by external scanners.

## License

Original code is released under the [Apache License 2.0](./LICENSE), with attribution in [NOTICE](./NOTICE). Personal branding, user-uploaded logos, images and user data are outside the code license.

Third-party dependencies retain their own licenses. See [third-party licenses](./THIRD-PARTY-LICENSES.txt) and the license comments preserved in the built JavaScript. Code licensing does not automatically cover personal branding, images or user data.
