const dayjs = require("dayjs");

const camposAuditoriaADD = [
    dayjs().format('YYYY-MM-DD'),
    2,
    null,
    2
];
const camposAuditoriaUPDATE = [
    dayjs().format('YYYY-MM-DD'),
    2
];
module.exports = {
    camposAuditoriaADD,
    camposAuditoriaUPDATE
}