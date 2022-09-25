import { ModuleMetadata } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Test, TestingModule } from "@nestjs/testing";
import { useContainer } from "class-validator";
import SecureSessionPlugin from "@fastify/secure-session";
import { stopMemoryServer } from "./mongoose-test.module";
import crypto from "crypto";
import { FastifyReply, FastifyRequest } from "fastify";
import { equal } from "assert";
import { Session, SessionKey } from "../common";
import testConfig from "../config/test-config";

let testingModule: TestingModule;
let app: NestFastifyApplication;

export function setupEndpointTests(metadata: ModuleMetadata) {
  const uncompiledModule = Test.createTestingModule({
    ...metadata,
    imports: [
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      ...metadata.imports,
      ConfigModule.forRoot({
        ignoreEnvFile: true,
        isGlobal: true,
        load: [testConfig],
      }),
    ],
  });

  const init = async () => {
    testingModule = await uncompiledModule.compile();
    app = testingModule.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter()
    );

    await app.register(SecureSessionPlugin, {
      // Secret must be 32 bytes
      secret: crypto.randomBytes(32).toString("hex"),
      // Salt must be 16 characters
      salt: crypto.randomBytes(8).toString("hex"),
    });

    useContainer(app, { fallbackOnErrors: true });
    await app.init();

    app
      .getHttpAdapter()
      .post("/set-session", (req: FastifyRequest, reply: FastifyReply) => {
        const body = req.body as Record<string, never>;
        req.session.set(body.key, body.value);
        reply.send(body);
      });

    const setSession = async (key: SessionKey, value: unknown) => {
      const { statusCode, headers } = await app.inject({
        method: "POST",
        url: "/set-session",
        payload: {
          key,
          value,
        },
      });

      equal(statusCode, 200);

      return {
        cookie: headers["set-cookie"] as string,
      };
    };

    const setAccessToken = async (accessToken: Session["accessToken"]) => {
      const { cookie } = await setSession(SessionKey.ACCESS_TOKEN, accessToken);

      return cookie;
    };

    await app.getHttpAdapter().getInstance().ready();

    return {
      app,
      setSession,
      setAccessToken,
    };
  };

  return {
    uncompiledModule,
    init,
  };
}

export async function teardownEndpointTests() {
  await stopMemoryServer();
  await app?.close();
  await testingModule?.close();
}
