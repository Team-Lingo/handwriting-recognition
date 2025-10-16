+ Roles: 
    - Developer - Full access to all accounts
    - Support -  Full access to all accounts
    - Advisor [User] - Read only access but to multiple accounts (his students)
    - Normal [User] - Full access but only one account 

+ Structure inside collections (tables):
    - Users
        (R) Developer, Support, Users
        (W) Developer, Support, Users
    - Analytics
        (R) Developer, Support, Users
        (W) Developer
    - Conversations
        (R) Developer, Support, Advisor(his students' conversation), User(his conversations)
        (W) Developer, Support
    - Files
        (R) Developer, Support, Users
        (W) Developer, Support, Users
