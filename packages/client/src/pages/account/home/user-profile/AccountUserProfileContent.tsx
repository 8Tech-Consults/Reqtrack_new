import { PersonalInfo, ProfileSettingsForm, ChangePassword } from './blocks';

const AccountUserProfileContent = () => {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 lg:gap-7.5">
      <div className="xl:col-span-1">
        <PersonalInfo />
      </div>

      <div className="xl:col-span-2 grid gap-5 lg:gap-7.5">
        <ProfileSettingsForm />
        <ChangePassword />
      </div>
    </div>
  );
};

export { AccountUserProfileContent };
