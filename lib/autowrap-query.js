module.exports = function autowrapQuery(queryable) {
    var oldQuery = queryable.query;
    queryable.query = function(query, valuesOrCb, callback) {
        if (typeof(query) === 'string') {
            return oldQuery.call(this, query, valuesOrCb, callback);
        } else {
            return oldQuery.call(this, query.text, query.values, valuesOrCb);
        }

    }
}
