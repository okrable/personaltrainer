# Input Modal Guide

This guide explains each setting in the **Plan settings** modal and how it affects daily workout suggestions.

## Goal race type
- **What it is:** Free-text description of your target race (e.g., `Hilly trail marathon`, `Half marathon road`).
- **How it is used:** Influences workout style and terrain bias (for example, hill-focused quality sessions when a hilly goal is detected).

## Race date
- **What it is:** The target event date.
- **How it is used:** Determines time-to-race, current week/day in plan, and overall training phase (Foundation, Build, Peak, Taper).

## Plan length (weeks)
- **What it is:** Total training cycle duration.
- **How it is used:** Converts race countdown into current week/day and phase context for workout selection.

## Weekly distance (km)
- **What it is:** Current typical weekly running volume.
- **How it is used:** Scales easy-day distance targets and helps set daily load expectations.

## Current training load
- **What it is:** Subjective load status (`Low`, `Moderate`, `High`).
- **How it is used:** Applies intensity safeguards. High load biases easier/recovery guidance.

## Recent terrain
- **What it is:** Type of routes you are mostly running (`Mostly flat`, `Mixed`, `Hilly`, `Trail-heavy`).
- **How it is used:** Shapes quality session type (e.g., hill sessions for hilly/trail context).

## Time available (minutes)
- **What it is:** Time budget for today's run.
- **How it is used:** Caps workout length and affects easy/quality workout structure.

## Last quality workout (days ago)
- **What it is:** Days since your last harder session.
- **How it is used:** Protects recovery by reducing intensity when quality sessions are too close together.

## Strava sync fields (outside modal)
After syncing Strava, additional metrics are injected into AI workout generation:
- Weekly average distance
- Recent run count
- Quality-session count and recency
- Elevation in recent weeks
- Average pace and fastest recent pace

These are used to tune target pace and RPE for both easy and quality options.


## Strava override behavior
- When Strava sync is active, **Current training load** and **Last quality workout** in the modal become read-only.
- The app uses Strava-derived load heuristics and quality-session recency instead of manual values.
- This keeps day-to-day coaching decisions aligned with your real training history.
