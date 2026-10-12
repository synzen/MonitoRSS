import { Entity, PrimaryKey, Property } from "@mikro-orm/decorators/legacy";

@Entity({
  collection: 'profiles'
})
class Profile {
  @PrimaryKey()
  _id!: string;

  @Property({ nullable: true })
  alert?: string[];
}

export default Profile
