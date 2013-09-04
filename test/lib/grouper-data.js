
/*
User hasMany userAccount
UserAccount hasOne account
Account hasMany userAccounts

UserAccount.from(
    UserAccount.join(UserAccont.account).on(...)
    .join(UserAccount.account.userAccounts).on(...)
    .selectDeep(UserAccount.id, UserAccount.account.id, UserAccount.account.userAccounts.id))
*/

exports.minraw = [
    { 'id##': 1, 'account.id##': 1, 'account.userAccounts[].id##': 1 },
    { 'id##': 1, 'account.id##': 1, 'account.userAccounts[].id##': 2 },
];

exports.mininput =[
    { 'id##': 1, account: {'id##': 1, 'userAccounts[]': {'id##': 1 }}},
    { 'id##': 1, account: {'id##': 1, 'userAccounts[]': {'id##': 2 }}},
];

exports.minoutput = [
    {
        id: 1,
        account: { 
            id: 1,
            userAccounts: [ {id: 1}, {id: 2} ]
        }
    }
];


// Nesting does work, as long as the nested stuff are also groups:

exports.raw = [
    {'id##': 1, 'posts[].id': 1, 'posts[].content': 'a', 'posts[].comments[].id': 1, 'posts[].comments[].content':'c1' },
    {'id##': 1, 'posts[].id': 1, 'posts[].content': 'a', 'posts[].comments[].id': 2, 'posts[].comments[].content':'c2' },
    {'id##': 1, 'posts[].id': 2, 'posts[].content': 'a', 'posts[].comments[].id': null, 'posts[].comments[].content':null },
    {'id##': 2, 'posts[].id': 3, 'posts[].content': 'a', 'posts[].comments[].id': null, 'posts[].comments[].content':null },
    {'id##': 3, 'posts[].id': 4, 'posts[].content': 'a', 'posts[].comments[].id': null, 'posts[].comments[].content':null },
    {'id##': 3, 'posts[].id': 5, 'posts[].content': 'a', 'posts[].comments[].id': null, 'posts[].comments[].content':null },
    {'id##': 4, 'posts[].id': null, 'posts[].content': null, 'posts[].comments[].id': null, 'posts[].comments[].content':null }
];



exports.input = [
    {'id##': 1, 'posts[]': { id: 1, content: 'a', 'comments[]': { id: 1, content:'c1' }}},
    {'id##': 1, 'posts[]': { id: 1, content: 'a', 'comments[]': { id: 2, content:'c2' }}},
    {'id##': 1, 'posts[]': { id: 2, content: 'b', 'comments[]': { id: null, content: null}}},
    {'id##': 2, 'posts[]': { id: 3, content: 'c', 'comments[]': { id: null, content: null}}},
    {'id##': 3, 'posts[]': { id: 4, content: 'd', 'comments[]': { id: null, content: null}}},
    {'id##': 3, 'posts[]': { id: 5, content: 'e', 'comments[]': { id: null, content: null}}},
    {'id##': 4, 'posts[]': { id:null, content: null, 'comments[]': {id: null, content: null}}}
];


exports.output = [
  { id: 1,
    posts: 
     [ { id: 1,
         content: 'a',
         comments: [ { id: 1, content: 'c1' }, { id: 2, content: 'c2' } ] },
       { id: 2, content: 'b', comments: [] } ] },
  { id: 2, posts: [ { id: 3, content: 'c', comments: [] } ] },
  { id: 3,
    posts: 
     [ { id: 4, content: 'd', comments: [] },
       { id: 5, content: 'e', comments: [] } ] },
  { id: 4, posts: [] } 
];

