let success = (options) => {
    let title = 'Success';
    let message = '';
    let className = 'success-dialog';
    if (typeof options == 'string') {
        message = options;
    } else {
        message = options.message;
    }
    bootbox.alert({
        title,
        message,
        className
    });
};

let err = (options) => {
    let title = 'Error';
    let message = '';
    let className = 'error-dialog';
    if (typeof options == 'string') {
        message = options;
    } else {
        message = options.message;
    }
    bootbox.alert({
        title,
        message: message,
        className
    });
};
export default {
    success,
    err
};