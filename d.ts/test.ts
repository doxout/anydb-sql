import * as dbsql from 'anydb-sql'

let db = dbsql({});

interface User {
    id: string
    name: string
    created: Date
}

let User = db.define<'User', User>({
    name: 'User',
    columns: {
        id: {name: 'id', dataType: 'string'},
        name: {name: 'name', dataType: 'string'},
        created: {name: 'created', dataType: 'date'}
    }
})

interface Post {
    id: string
    name: string;
    created: Date;
    userId: string;
}


let Post = db.define<'Post', Post>({
    name: 'Post',
    columns: {
        id: {name: 'id', dataType: 'string'},
        name: {name: 'name', dataType: 'string'},
        created: {name: 'created', dataType: 'date'},
        userId: {name: 'userId', dataType: 'string'}
    }
})


let q2 = User.select(User.name)

let q3 = User.where({id: 1}).select(User.name, User.id)

q3.get().then(u => u.id)

let q4 = User
    .from(User.join(Post).on(User.id.equals(Post.userId)))
    .selectDeep(User, Post)

let all = q4.all().then(x => x[0].Post.created)
