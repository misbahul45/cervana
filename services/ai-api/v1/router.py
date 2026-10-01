from fastapi import APIRouter
from config.envs import ENVS
from v1.resources.router import router as resourcesRouter
from v1.users_steps.router import router as usersStepsRouter
from v1.learning.router import router as learningRouter
v1Router=APIRouter(
    prefix=f"/{ENVS['APP_VERSION']}"
)

v1Router.include_router(resourcesRouter)
v1Router.include_router(usersStepsRouter)
v1Router.include_router(learningRouter)


