# A service discovery sample for Lambda and ECS architecture

## Architecture Diagram
![ECS Service Discovery Architecture](asset/ecs-servicediscovery-architecture.png)

## Install CDK and project dependencies
```sh
$ yarn global add cdk
```

```sh
$ yarn
```

## Bootstrap and Deploy
```sh
$ cdk bootstrap
$ cdk -c namespace=whatevernamespace.local -O outputs.json deploy
```

## Test
```sh
$ curl -i $(cat outputs.json | jq -r ".\"ecs-servicediscovery-stack-dev\".ApiEndpoint")
```

Expected respond
```
{"time":*unix epoch*}
```
