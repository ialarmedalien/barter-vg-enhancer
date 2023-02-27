import $ from 'jquery';

import Router from './modules/router';
import controllers from './controllers/controllers';
import variables from './modules/templates';

$('head').append($('<style type="text/css">' + variables.css.style + '</style>'));

const router = new Router();
controllers.forEach((controller) => {
    router.registerRoutes(controller.routes);
});

router.route();
