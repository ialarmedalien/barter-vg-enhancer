import Router from './modules/router';
import controllers from './controllers/controllers';
import variables from './modules/templates';

const style = document.createElement('style');
style.setAttribute('type', 'text/css');
style.textContent = variables.css.style;
document.querySelector('head').append(style);

const router = new Router();
controllers.forEach((controller) => {
    router.registerRoutes(controller.routes);
});

router.route();
