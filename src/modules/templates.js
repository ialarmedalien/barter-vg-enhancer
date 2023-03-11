const variables = {
    css: {
        style: `
.small, span {
    font-size: 0.8rem;
}
.bve-game-details {
    display: flex;
    flex-direction: column;
    text-align: right;
    font-size: 0.8rem;
    line-height: 1.35;
}
.bve-trade-summary {
    width: 100%;
}
.bve-information-highlight {
    border-bottom: dotted 1px;
    cursor: help;
    font-size: 16px;
}
.ratio, .bundled {
    font-size: 1rem;
    padding: 0.25rem;
}
.matchcol li {
    padding: 0.4rem 0;
}
.tradables li {
    display: flex;
    border-bottom: 1px dotted dodgerblue;
}
.tradables_info {
    max-width: unset;
    flex: 380px 1;
    display: block;
}
.price-details img {
    max-height: 0.8rem;
    max-width: 0.8rem;
}
.matchcol {
    padding-top: 0;
}
.matchcol li {
    border-top: 1px solid #f60;
}
.matchcol.matcht li {
    border-color: #09f;
}
.game-details {
    display: inline-block;
}
.steam_price, .itad_price, .lowest_price {
    padding: 0.2rem;
    margin: 0.2rem;
}
`,
    },
    html: {
        gameDetails:
            `<div class="bve-game-details">` +
            `    <div>H:W Ratio: <span class="bve-game-details__trade-ratio">{0}</span></div>` +
            `    <div>Bundles: <span class="bve-game-details__trade-ratio">{1}</span></div>` +
            `    <div>Steam: <span class="bve-game-details__steam-price">Loading...</span></div>` +
            `    <div>ITAD: <span class="bve-game-details__itad-price">Loading...</span></div>` +
            `    <div>Lowest: <span class="bve-game-details__lowest-price">Loading...</span></div>` +
            `</div>`,
        tradeSummary:
            `<table class="bve-trade-summary">` +
            `    <caption>Trade summary:</caption>` +
            `    <tr>` +
            `        <th>Games that have been bundled</th>` +
            `        <td>{1}</td>` +
            `    </tr>` +
            `    <tr>` +
            `        <th>Total bundles</th>` +
            `        <td>{8}</td>` +
            `    </tr>` +
            `    <tr>` +
            `        <th>Average review score` +
            `            <span title="The more reviews it has, the proportionally larger that game's impact on the score" ` +
            `            class="bve-information-highlight">(weighted)</span>` +
            `        </th>` +
            `        <td>{4}% ({5}%)</td>` +
            `    </tr>` +
            `    <tr>` +
            `        <th>Number of reviews` +
            `            <span title="The binary logarithm of the number of reviews. A difference of +1 means ` +
            `            &quot;twice as popular&quot;, and -1 means &quot;half as popular&quot;."` +
            `             class="bve-information-highlight">(log<sub>2</sub>)</span>` +
            `        </th>` +
            `        <td>{10} ({11})</td>` +
            `    </tr>` +
            `    <tr>` +
            `        <th>Tradability (H : W)</th>` +
            `        <td>{6} ({9})</td>` +
            `    </tr>` +
            `    <tr>` +
            `        <th>Total price on Steam (ignoring any active discounts)</th>` +
            `        <td id="{12}_total_steam">Loading...</td>` +
            `    </tr>` +
            `    <tr>` +
            `        <th>Average price per game on Steam (ignoring any active discounts)</th>` +
            `        <td id="{12}_average_steam">Loading...</td>` +
            `    </tr>` +
            `    <tr>` +
            `        <th>Best price on ITAD</th>` +
            `        <td id="{12}_total_itad">Loading...</td>` +
            `    </tr>` +
            `</table>`,
    },
};

export default variables;
