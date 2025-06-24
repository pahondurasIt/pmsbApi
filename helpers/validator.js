const isValidNumber = (value) => {
    return (isNaN(value) || value === null || value === undefined) ?
        false : true

}
const isValidString = (value) => {
    return (value === null || value === undefined || value.trim() === '') ?
        false : true
}
 
module.exports = {
    isValidNumber,
    isValidString
}
