# First stage: compile things.
FROM node:16-alpine AS build
WORKDIR /usr/src/app

# (Install OS dependencies; include -dev packages if needed.)

# Install the Javascript dependencies, including all devDependencies.
COPY package.json .
RUN npm install

# Copy the rest of the application in and build it.
COPY . .
# RUN npm build
RUN npx tsc -p ./tsconfig.json

# Now /usr/src/app/dist has the built files.

# Second stage: run things.
FROM node:16-alpine
WORKDIR /usr/src/app

# (Install OS dependencies; just libraries.)

# Install the Javascript dependencies, only runtime libraries.
COPY package.json .
RUN npm install --production

# Copy the dist tree from the first stage.
COPY --from=build /usr/src/app/dist dist

# Run the built application when the container starts.
CMD ["npm", "run", "serve"]