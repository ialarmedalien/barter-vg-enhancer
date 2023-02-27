const variables = {
    css: {
        style: `
.bve-game-details {
    position: absolute;
    top: 0;
    right: 15px;
    text-align: right;
}
.bve-game-details__steam-store-price, .bve-game-details__trade-ratio {
        font-size: 100%;
    }
}

.bve-trade-summary {
    width: 100%;
}

.bve-information-highlight {
    border-bottom: dotted 1px;
    cursor: help;
    font-size: 16px;
}
`,
    },
    html: {
        gameDetails: `<div class="bve-game-details">
    <span><span class="bve-game-details__steam-store-price">Loading...</span></span>
    <br>
    <span>H:W Ratio: <span class="bve-game-details__trade-ratio">{0}</span></span>
</div>`,
        tradeSummary: `<table class="bve-trade-summary">
    <caption>Trade summary:</caption>
    <tr>
        <th>Games in bundles</th>
        <td>{1}</td>
    </tr>
    <tr>
        <th>Total bundles</th>
        <td>{8}</td>
    </tr>
    <tr>
        <th>Average review score
            <span title="The more reviews it has, the proportionally larger that game's impact on the score" class="bve-information-highlight">(weighted)</span>
        </th>
        <td>{4}% ({5}%)</td>
    </tr>
    <tr>
        <th>Number of reviews
            <span title="The binary logarithm of the number of reviews. A difference of +1 means &quot;twice as popular&quot;, and -1 means &quot;half as popular&quot;."
             class="bve-information-highlight">(log<sub>2</sub>)</span>
        </th>
        <td>{10} ({11})</td>
    </tr>
    <tr>
        <th>Trade ratio (H : W)</th>
        <td>{6} ({9})</td>
    </tr>
    <tr>
        <th>Total price on Steam (ignoring any active discounts)</th>
        <td id="{12}_total_value">Loading...</td>
    </tr>
    <tr>
        <th>Average price per game on Steam (ignoring any active discounts)</th>
        <td id="{12}_average_value">Loading...</td>
    </tr>
</table>`,
    },
};

export default variables;
