type Brand<T, Name extends string> = T & { readonly __brand: Name };

export type UserId = string & { readonly __brand: "UserId" };

/** Spells a user id. A scalar constructor is the one kind of function a model holds. */
export function userIdOf(value: string): UserId {
  return value as UserId;
}
type DateTime = Brand<string, "DateTime">;

export type ProjectId = Brand<string, "ProjectId">;

/** The container a commitment belongs to. Leaf data, like every model. */
export interface Project {
  readonly id: ProjectId;
  readonly userId: UserId;
  readonly name: string;
  readonly createdAt: DateTime;
}

/** Who the request is acting as. Every repository call takes one. */
export interface ActorContext {
  readonly userId: UserId;
}
