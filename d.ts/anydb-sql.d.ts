
declare module "anydb-sql" {
    import Promise = require('bluebird');

    interface AnyDBPool extends anydbSQL.DatabaseConnection {
        query:(text:string, values:any[], callback:(err:Error, result:any)=>void)=>void
        begin:()=>anydbSQL.Transaction
        close:(err:Error)=>void
    }

    module anydbSQL {
        export interface OrderByValueNode {}

        interface Named<Name extends string> {
            name?: Name;
        }
        export interface ColumnDefinition<Name extends string, Type> extends Named<Name> {
            primaryKey?:boolean;
            dataType?:string;
            references?: {table:string; column: string}
            notNull?:boolean
            unique?:boolean
            defaultValue?: Type
        }

        export interface TableDefinition<Name extends string, Row> {
            name: Name
            columns:{[CName in keyof Row]: ColumnDefinition<CName, Row[CName]>}
            has?:{[key: string]:{from:string; many?:boolean}}
        }

        export interface QueryLike {
            query:string;
            values: any[]
            text:string
        }
        export interface DatabaseConnection {
            queryAsync<T>(query:string, ...params:any[]):Promise<{rowCount:number;rows:T[]}>
            queryAsync<T>(query:QueryLike):Promise<{rowCount:number;rows:T[]}>
        }

        export interface Transaction extends DatabaseConnection {
            rollback():void
            commitAsync():Promise<void>
        }

        interface Executable<T> {
            get():Promise<T>
            getWithin(tx:DatabaseConnection):Promise<T>
            exec():Promise<void>
            all():Promise<T[]>
            execWithin(tx:DatabaseConnection):Promise<void>
            allWithin(tx:DatabaseConnection):Promise<T[]>
            toQuery():QueryLike;
        }

        interface Queryable<T> {
            where(...nodes:any[]):Query<T>
            delete():ModifyingQuery
            select<N1 extends string, T1>(n1: Column<N1, T1>):Query<T1>
            select<N1 extends string, T1, N2 extends string, T2>(
                n1: Column<N1, T1>,
                n2: Column<N2, T2>):Query<{[N in N1]: T1} & {[N in N2]: T2}>
            select<N1 extends string, T1, N2 extends string, T2, N3 extends string, T3>(
                n1: Column<N1, T1>,
                n2: Column<N2, T2>,
                n3: Column<N3, T3>):Query<{[N in N1]: T1} & {[N in N2]: T2} & {[N in N3]: T3}>
            select<U>(...nodesOrTables:any[]):Query<U>

            selectDeep<N1 extends string, T1>(n1: Table<N1, T1>):Query<T1>
            selectDeep<N1 extends string, T1, N2 extends string, T2>(
                n1: Table<N1, T1>,
                n2: Table<N2, T2>):Query<{[N in N1]: T1} & {[N in N2]: T2}>
            selectDeep<N1 extends string, T1, N2 extends string, T2, N3 extends string, T3>(
                n1: Table<N1, T1>,
                n2: Table<N2, T2>,
                n3: Table<N3, T3>):Query<{[N in N1]: T1} & {[N in N2]: T2} & {[N in N3]: T3}>
            //selectDeep<U>(...nodesOrTables:any[]):Query<U>
        }

        export interface Query<T> extends Executable<T>, Queryable<T> {
            from(table:TableNode):Query<T>
            from(statement:string):Query<T>
            update(o:{[key: string]:any}):ModifyingQuery
            update(o:{}):ModifyingQuery
            group(...nodes:any[]):Query<T>
            order(...criteria:OrderByValueNode[]):Query<T>
            limit(l:number):Query<T>
            offset(o:number):Query<T>
        }

        export interface SubQuery<T> {
            select<Name>(node:Column<Name, T>):SubQuery<T>
            select(...nodes: any[]):SubQuery<T>
            where(...nodes:any[]):SubQuery<T>
            from(table:TableNode):SubQuery<T>
            from(statement:string):SubQuery<T>
            group(...nodes:any[]):SubQuery<T>
            order(criteria:OrderByValueNode):SubQuery<T>
            exists():BinaryNode
            notExists(): BinaryNode;
            notExists(subQuery:SubQuery<any>):BinaryNode
        }


        export interface ModifyingQuery extends Executable<void> {
            returning<U>(...nodes:any[]):Query<U>
            where(...nodes:any[]):ModifyingQuery
        }

        export interface TableNode {
            join(table:TableNode):JoinTableNode
            leftJoin(table:TableNode):JoinTableNode
        }

        export interface JoinTableNode extends TableNode {
            on(filter:BinaryNode):TableNode
            on(filter:string):TableNode
        }

        interface CreateQuery extends Executable<void> {
            ifNotExists():Executable<void>
        }
        interface DropQuery extends Executable<void> {
            ifExists():Executable<void>
        }

        type Columns<T> = {
            [Name in keyof T]: Column<Name, T[Name]>
        }
        type Table<Name extends string, T> = TableNode & Queryable<T> & Named<Name> & Columns<T> & {

            create():CreateQuery
            drop():DropQuery
            as<OtherName extends string>(name:OtherName):Table<OtherName, T>
            update(o:any):ModifyingQuery
            insert(row:T):ModifyingQuery
            insert(rows:T[]):ModifyingQuery
            select():Query<T>
            select<U>(...nodes:any[]):Query<U>
            from<U>(table:TableNode):Query<U>
            from<U>(statement:string):Query<U>
            star():Column<void, void>
            subQuery<U>():SubQuery<U>
            eventEmitter:{emit:(type:string, ...args:any[])=>void
                          on:(eventName:string, handler:Function)=>void}
            columns:Column<void, void>[]
            sql: SQL;
            alter():AlterQuery<T>;
            indexes(): IndexQuery;
        }

        type Selectable<Name extends string, T> = Table<Name, T> | Column<Name, T>

        export interface AlterQuery<T> extends Executable<void> {
            addColumn(column:Column<any, any>): AlterQuery<T>;
            addColumn(name: string, options:string): AlterQuery<T>;
            dropColumn(column: Column<any, any>|string): AlterQuery<T>;
            renameColumn(column: Column<any, any>, newColumn: Column<any, any>):AlterQuery<T>;
            renameColumn(column: Column<any, any>, newName: string):AlterQuery<T>;
            renameColumn(name: string, newName: string):AlterQuery<T>;
            rename(newName: string): AlterQuery<T>
        }
        export interface IndexQuery {
            create(): IndexCreationQuery;
            create(indexName: string): IndexCreationQuery;
            drop(indexName: string): Executable<void>;
            drop(...columns: Column<any, any>[]): Executable<void>
        }
        export interface IndexCreationQuery extends Executable<void> {
            unique(): IndexCreationQuery;
            using(name: string): IndexCreationQuery;
            on(...columns: (Column<any, any>|OrderByValueNode)[]): IndexCreationQuery;
            withParser(parserName: string): IndexCreationQuery;
            fulltext(): IndexCreationQuery;
            spatial(): IndexCreationQuery;
        }

        export interface SQL {
            functions: {
                LOWER<Name>(c:Column<Name, string>):Column<Name, string>
            }
        }

        export interface BinaryNode {
            and(node:BinaryNode):BinaryNode
            or(node:BinaryNode):BinaryNode
        }

        export interface Column<Name, T> {
            name: Name
            in(arr:T[]):BinaryNode
            in(subQuery:SubQuery<T>):BinaryNode
            notIn(arr:T[]):BinaryNode
            equals(node:any):BinaryNode
            notEquals(node:any):BinaryNode
            gte(node:any):BinaryNode
            lte(node:any):BinaryNode
            gt(node:any):BinaryNode
            lt(node:any):BinaryNode
            like(str:string):BinaryNode
            multiply:{
                (node:Column<any, T>):Column<any, T>
                (n:number):Column<any, number> //todo check column names
            }
            isNull():BinaryNode
            isNotNull():BinaryNode
            //todo check column names
            sum():Column<any, number>
            count():Column<any, number>
            count(name:string):Column<any, number>
            distinct():Column<Name, T>
            as<OtherName>(name:OtherName):Column<OtherName, T>
            ascending:OrderByValueNode
            descending:OrderByValueNode
            asc:OrderByValueNode
            desc:OrderByValueNode
        }

        export interface AnydbSql extends DatabaseConnection {
            define<Name extends string, T>(map:TableDefinition<Name, T>):Table<Name, T>;
            transaction<T>(fn:(tx:Transaction)=>Promise<T>):Promise<T>
            allOf(...tables:Table<any, any>[]):any
            models: {[key:string]: Table<any, any>}
            functions:{LOWER:<Name>(name:Column<Name, string>)=>Column<Name, string>
                       RTRIM:<Name>(name:Column<Name, string>)=>Column<Name, string>}
            makeFunction(name:string):Function
            begin():Transaction
            open():void;
            close():void;
            getPool():AnyDBPool;
            dialect():string;
        }
    }

    function anydbSQL(config:Object):anydbSQL.AnydbSql;

    export = anydbSQL;
}
