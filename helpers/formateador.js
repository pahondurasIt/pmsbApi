const formatNamePart = (namePart) => {
    if (!namePart) return ''; // Por si viene null o undefined
    const trimmed = namePart.trim(); // Elimina espacios al inicio y al final
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

module.exports = {
    formatNamePart
}