function randomName() {
    return 'sp' + Math.random().toString().split('.')[1]
}

module.exports = function(dialect) {
    return function() {
        var tx = this;
        var spname = randomName();
        if (dialect == 'mysql')
            spname = '`' + spname + '`';
        else
            spname = '"' + spname + '"';
        tx.query('SAVEPOINT ' + spname);
        function restore(cb) {
            return tx.query('ROLLBACK TO SAVEPOINT ' + spname, cb);
        }
        function release(cb) {
            return tx.query('RELEASE SAVEPOINT ' + spname, cb);
        }
        return {
            __savepoint: true,
            rollback: restore,
            commit: release,
            restore: restore,
            release: release,
            query: function() {
                return tx.query.apply(tx, arguments);
            },
            queryAsync: function() {
                return tx.queryAsyapply(tx, arguments);
            }
        };
    }
};
