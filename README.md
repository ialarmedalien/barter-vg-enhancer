# barter-vg-enhancer

Enhances the game bartering site [barter.vg](https://barter.vg) by adding price, bundle, and want:have ratios to the matches page and to offers pages.

Price data comes from [the Steam store](https://store.steampowered.com) and from [Is There Any Deal](https://isthereanydeal.com). Note that ITAD has incorrectly mapped some game IDs, so often if a price is not available, it is because the Steam ID maps to a different version (or DLC) of the game.

Install by adding `bundle.js` to your userscript manager (Tampermonkey, Greasemonkey, etc.) of choice.

Forked from https://github.com/alexschrod/barter-vg-enhancer
