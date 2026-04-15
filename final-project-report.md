
# ScholarIDE — Final Project Report

## Project Summary

ScholarIDE is a student-focused IDE that prioritizes learning. The project includes an instructor dashboard for class and student management as well as an AI tutor backend. It promotes learning by disabling external copy and pasting, disabling external and offline editing, and easing students into AI interaction.

---

## ERD

```
┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│     Supabase Auth (users)       │   │   Supabase Storage              │
│─────────────────────────────────│   │─────────────────────────────────│
│ id (uuid)                       │   │ workspaces/                     │
│ email                           │   │   {user_id}/                    │
└─────────────────────────────────┘   └─────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│           profiles              │   │            classes              │
│─────────────────────────────────│   │─────────────────────────────────│
│ id (uuid) PK                    │───│ id (uuid) PK                    │
│ role (student | instructor)     │   │ instructor_id (uuid) FK         │
│ display_name                    │   │ name                            │
└─────────────────────────────────┘   │ join_code (unique)              │
          │                           └─────────────────────────────────┘
          │                                     │
          ▼                                     ▼
┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│          enrollments            │   │          assignments            │
│─────────────────────────────────│   │─────────────────────────────────│
│ student_id (uuid) PK, FK        │   │ id (uuid) PK                    │
│ class_id (uuid) PK, FK          │   │ class_id (uuid) FK              │
│ enrolled_at (timestamptz)       │   │ title                           │
│ grade (numeric)  ← AUTO         │   │ starter_files (jsonb)           │
└─────────────────────────────────┘   └─────────────────────────────────┘
                                                │
                                                ▼
┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│         file_snapshots          │   │          submissions            │
│─────────────────────────────────│   │─────────────────────────────────│
│ id (uuid) PK                    │   │ id (uuid) PK                    │
│ user_id (uuid) FK               │   │ assignment_id (uuid) FK         │
│ class_id (uuid) FK              │   │ student_id (uuid) FK            │
│ file_path                       │   │ score                           │
│ content_hash (SHA-256)          │   │ feedback                        │
│ content (text)                  │   └─────────────────────────────────┘
└─────────────────────────────────┘             │
          │                                     │
          └───────────────┬─────────────────────┘
                          ▼
             ┌──────────────────────────┐
             │   submission_snapshots   │
             │──────────────────────────│
             │ submission_id (uuid) FK  │
             │ snapshot_id (uuid) FK    │
             └──────────────────────────┘

```

## Demo video

[ScholarIDE Demo Video](./Demo.mp4)

## What I learned

1. I learned more about database architecture and optimizations. 
2. I learned about Electron and how to work with the app to restrict user behavior. Specifically restricting command line behavior was tricky.
3. I learned about supabase auth and RLS and how to restrict authorization based on user status


## Integration with AI
This application integrates with anthropic to provide an AI tutor for the students to ask questions to. What is cool is that it has some prompt engineering before it hits anthropic so that the AI agent will not directly tell the student the answer.


## How did you use AI to build your project?
I used Antigravity to build this project. It helped out a lot with the learning curve of electron. I reviewed all of the code it generated and it helped me think through key features and implementations.

## Why this project is interesting to you
This project is very interesting to me because I feel that AI has distracted from my learning during school. ScholarIDE is a solution to that problem as it provides a sandboxed environment for learning.


## Explanation of failover strategy, scaling, performance, authentication

### Failover Strategy
- A student can work locally if Subabase or their network becomes unavailable. When it is restored their changes with sync.

### Scaling
- Supabase offers automatic scaling. If more is needed I will have to look into other solutions.

### Performance
- The application relies on the student's access to personal computers that can run the app. It will not be more intensive for the computer than VSCode. Supabase is reliable and the schema is set up to be scalable and efficient as it does not store redundant information. The AI agent backend uses claude-haiku which is a relatively simple model requiring not as much compute to fulfill requests. I plan on moving the AI agent backend into a supabase edge function which would make it more reliable since it would be a lambda.

### Authentication
- Scholaride uses Supabase to manage authentication and authorization. RLS locks down the database properly so that students and instructors have different access.


## Teams Post
[Link to teams post](https://teams.microsoft.com/l/message/19:01986f3a1f6a4ece8d64bb40d89bf09d@thread.tacv2/1776269279623?tenantId=c6fc6e9b-51fb-48a8-b779-9ee564b40413&groupId=5d8ddfcb-a9e8-4785-b9d1-c4579b243975&parentMessageId=1776269279623&teamName=CS%20452%20(Winter%202026)&channelName=Report%20-%20Final%20Project&createdTime=1776269279623)

## Status
Don't Share