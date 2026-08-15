type Brand<T, Name extends string> = T & { readonly __brand: Name };

type UserId = Brand<string, "UserId">;
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
