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
    margin: 0.25rem 0.5rem;
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
.tradables {
    padding: 0;
}
.tradables li {
    display: flex;
    border-bottom: 1px dotted dodgerblue;
}
.tradables tr[data-item-id] {
    border-bottom: 1px dotted dodgerblue;
}
.tradables .r_p span, .tradables .r_m span, .tradables .r_n span {
    line-height: .25em;
    line-height: 0.8rem;
}
.tradables .r_p, .tradables .r_p a {
    font-size: 1rem;
    line-height: 1rem;
}
.tradables_info {
    max-width: unset;
    flex: 380px 1;
    display: block;
}
.bve-game-details img, .price-details img {
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
.tradables li:last-child {
    border-bottom: 0;
}
`,
    },
    html: {
        gameDetails:
            `<div class="bve-game-details">` +
            `    <div>Tradability: <span class="bve-game-details__trade-ratio">{0}</span></div>` +
            `    <div>Bundles: <span class="bve-game-details__trade-ratio">{1}</span></div>` +
            `    <div><span class="bve-game-details__steam-price">Loading...</span></div>` +
            `    <div><span class="bve-game-details__itad-price">Loading...</span></div>` +
            `    <div><span class="bve-game-details__lowest-price">Loading...</span></div>` +
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
            `        <td>{2}</td>` +
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
            `        <td>{6} ({7})</td>` +
            `    </tr>` +
            `    <tr>` +
            `        <th>Tradability (H : W)</th>` +
            `        <td>{8} ({9})</td>` +
            `    </tr>` +
            `    <tr>` +
            `        <th>Total price on Steam (ignoring any active discounts)</th>` +
            `        <td id="{0}_total_steam">Loading...</td>` +
            `    </tr>` +
            `    <tr class="average">` +
            `        <th>Average price per game on Steam (ignoring any active discounts)</th>` +
            `        <td id="{0}_average_steam">Loading...</td>` +
            `    </tr>` +
            `    <tr>` +
            `        <th>Best price on ITAD</th>` +
            `        <td id="{0}_total_itad">Loading...</td>` +
            `    </tr>` +
            `    <tr class="average">` +
            `        <th>Average price on ITAD</th>` +
            `        <td id="{0}_average_itad">Loading...</td>` +
            `    </tr>` +
            `</table>`,
    },
};

export default variables;
