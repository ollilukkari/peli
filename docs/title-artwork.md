# Start-menu title artwork

The title in `index.html` is fixed artwork for the phrase **PIKKU / PUPUN / POMPUTTELU / PELI**, rendered from Cooper Black. Each complete word is an SVG path. The repository does not include or serve a font file, a converted font, or a reusable alphabet.

The four words have equal visible widths of 324 units, with their original letter proportions and 8-unit gaps. CSS scales the complete logo to 92% of the game frame, leaving 4% on either side. The word POMPUTTELU inherits the current world's accent color. A visually hidden text label preserves the accessible H1 heading.

The fixed artwork renders without installed fonts, network font requests, or JavaScript text measurement. It is included in the cached HTML for offline use.

Font information: [Microsoft's Cooper Black family page](https://learn.microsoft.com/en-us/typography/font-list/cooper-black). The licensing reference linked from that page is the [font redistribution FAQ](https://learn.microsoft.com/en-us/typography/fonts/font-faq), which distinguishes graphics of words or phrases used as game logos from redistribution of the font itself.
