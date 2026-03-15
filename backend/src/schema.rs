diesel::table! {
    use diesel::sql_types::*;
    use diesel::sql_types::Jsonb;
    use diesel::sql_types::Timestamp;
    use diesel::sql_types::Uuid;

    questions (id) {
        id -> Uuid,
        slug -> Varchar,
        name -> Varchar,
        payload -> Jsonb,
        created_at -> Timestamp,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use diesel::sql_types::Timestamp;
    use diesel::sql_types::Uuid;

    scores (id) {
        id -> Uuid,
        name -> Varchar,
        score -> Int4,
        slug -> Varchar,
        created_at -> Timestamp,
    }
}
